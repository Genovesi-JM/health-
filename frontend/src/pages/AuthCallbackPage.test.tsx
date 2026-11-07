import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthCallbackPage from './AuthCallbackPage';

const { login, logout, refreshUser, persistSession, t } = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(), persistSession: vi.fn(), t: (key: string) => key }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ login, logout, refreshUser }) }));
vi.mock('../i18n/LanguageContext', () => ({ useT: () => ({ t }) }));
vi.mock('../api', () => ({ persistSession }));

function mount() {
  render(<MemoryRouter initialEntries={['/auth/callback?token=synthetic-token&role=doctor&redirect=/doctor/dashboard']}>
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/professional-verification" element={<div>Professional application</div>} />
      <Route path="/doctor/dashboard" element={<div>Clinical dashboard</div>} />
    </Routes>
  </MemoryRouter>);
}

describe('OAuth callback routing', () => {
  beforeEach(() => { login.mockReset(); logout.mockReset(); refreshUser.mockReset(); persistSession.mockReset(); });

  it('uses server account state before following a callback role or redirect', async () => {
    refreshUser.mockResolvedValue({ id: 'applicant', role: 'patient', professional_application: { profession: 'doctor', status: 'draft' } });
    mount();
    expect(await screen.findByText('Professional application')).toBeInTheDocument();
    expect(login).toHaveBeenCalledOnce();
    expect(refreshUser).toHaveBeenCalledOnce();
    expect(login.mock.calls[0][0].user.role).toBe('patient');
    expect(persistSession.mock.calls[0][0].user.role).toBe('patient');
    expect(screen.queryByText('Clinical dashboard')).not.toBeInTheDocument();
  });

  it('keeps the user on an error view if identity verification fails', async () => {
    refreshUser.mockRejectedValue(new Error('Identity unavailable'));
    mount();
    expect(await screen.findByText('authcb.process_error')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(logout).toHaveBeenCalledOnce();
    expect(screen.queryByText('Clinical dashboard')).not.toBeInTheDocument();
  });
});
