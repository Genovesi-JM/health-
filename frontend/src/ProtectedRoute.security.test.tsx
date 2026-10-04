import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
vi.mock('./components/ChatWidget', () => ({ default: () => null }));
vi.mock('./components/LanguageSelector', () => ({ default: () => null }));

const consents = [
  'terms_of_service', 'privacy_policy', 'medical_disclaimer',
  'health_data_processing', 'telemedicine_consent',
].map(consent_type => ({ consent_type }));

function mount(pathname = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected clinical content</div>} />
          <Route path="/consent-gate" element={<div>Consent form</div>} />
          <Route path="/onboarding/patient" element={<div>Patient onboarding form</div>} />
          <Route path="/professional-verification" element={<div>Application evidence</div>} />
          <Route path="/settings" element={<div>Account settings</div>} />
          <Route path="/security" element={<div>Account security</div>} />
          <Route path="/security/mfa" element={<div>MFA settings</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('patient consent fails closed', () => {
  beforeEach(() => {
    get.mockReset();
    sessionStorage.clear();
    auth.user = { id: 'synthetic-patient', role: 'patient', email: 'patient@example.test', is_active: true, patient_onboarding_complete: true };
  });

  it('blocks protected content when the consent service fails', async () => {
    get.mockRejectedValue(new Error('synthetic network failure'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('consent.check_error');
    expect(screen.getByRole('alert')).toHaveClass('consent-check-error');
    expect(screen.queryByText('Protected clinical content')).not.toBeInTheDocument();
    expect(screen.queryByText('Consent form')).not.toBeInTheDocument();
  });

  it('does not trust a client-controlled acceptance cache', async () => {
    sessionStorage.setItem('consents_accepted', 'true');
    get.mockResolvedValue({ data: [] });
    mount();
    expect(await screen.findByText('Consent form')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/v1/compliance/consents');
    expect(screen.queryByText('Protected clinical content')).not.toBeInTheDocument();
  });

  it('allows retry only after the server confirms all required consents', async () => {
    get.mockRejectedValueOnce(new Error('synthetic failure')).mockResolvedValueOnce({ data: consents });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'common.retry' }));
    expect(await screen.findByText('Protected clinical content')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('does not flash protected content while the check is pending', async () => {
    get.mockReturnValue(new Promise(() => undefined));
    mount();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Protected clinical content')).not.toBeInTheDocument();
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
