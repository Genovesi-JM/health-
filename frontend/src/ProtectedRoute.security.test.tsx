import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import type { User } from './types';

const { get, auth } = vi.hoisted(() => ({
  get: vi.fn(),
  auth: { user: { id: 'synthetic-patient', role: 'patient' } as User, loading: false },
}));
vi.mock('./api', () => ({ default: { get } }));
vi.mock('./AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./i18n/LanguageContext', () => ({ useT: () => ({ t: (key: string) => key }) }));
vi.mock('./components/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./components/LanguageSelector', () => ({ default: () => null }));

function mount(pathname = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected clinical content</div>} />
          <Route path="/consent-gate" element={<div>Consent form</div>} />
          <Route path="/onboarding/patient" element={<div>Patient onboarding form</div>} />
          <Route path="/professional-verification" element={<div>Application evidence</div>} />
          <Route path="/consents" element={<div>Consent controls</div>} />
          <Route path="/settings" element={<div>Account settings</div>} />
          <Route path="/security" element={<div>Account security</div>} />
          <Route path="/security/mfa" element={<div>MFA settings</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('consent decisions do not block personal records', () => {
  beforeEach(() => {
    get.mockReset();
    sessionStorage.clear();
    auth.user = { id: 'synthetic-patient', role: 'patient', email: 'patient@example.test', is_active: true, patient_onboarding_complete: true };
  });

  it.each([new Error('Consent catalog offline'), null])('keeps authenticated personal reads reachable when consent is missing or unavailable', async failure => {
    if (failure) get.mockRejectedValue(failure); else get.mockResolvedValue({ data: [] });
    sessionStorage.setItem('consents_accepted', 'true');
    mount();
    expect(await screen.findByText('Protected clinical content')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByText('Consent form')).not.toBeInTheDocument();
  });

  it('allows unfinished patients to review consent controls without a redirect loop', async () => {
    auth.user.patient_onboarding_complete = false;
    mount('/consents');
    expect(await screen.findByText('Consent controls')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('routes a new patient to onboarding before checking clinical consents', async () => {
    auth.user.patient_onboarding_complete = false;
    mount();
    expect(await screen.findByText('Patient onboarding form')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByText('Protected clinical content')).not.toBeInTheDocument();
  });

  it.each([
    ['/settings', 'Account settings'],
    ['/security', 'Account security'],
    ['/security/mfa', 'MFA settings'],
  ])('allows an unfinished patient to use %s without clinical consent', async (path, content) => {
    auth.user.patient_onboarding_complete = false;
    get.mockRejectedValue(new Error('Consent service is unavailable'));
    mount(path);
    expect(await screen.findByText(content)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByText('Patient onboarding form')).not.toBeInTheDocument();
    expect(screen.queryByText('Consent form')).not.toBeInTheDocument();
  });

  it('lets a least-privilege professional applicant reach evidence without patient consent', async () => {
    auth.user.patient_onboarding_complete = false;
    auth.user.professional_application = { profession: 'nurse', status: 'draft' };
    mount();
    expect(await screen.findByText('Application evidence')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByText('Consent form')).not.toBeInTheDocument();
  });

  it('does not apply patient medical consents to a nurse account', async () => {
    auth.user.role = 'nurse';
    mount();
    expect(await screen.findByText('Protected clinical content')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
