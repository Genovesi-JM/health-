import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const { get, getSession } = vi.hoisted(() => ({ get: vi.fn(), getSession: vi.fn() }));
vi.mock('./api', () => ({ default: { get }, getSession, persistSession: vi.fn(), clearSession: vi.fn() }));

function Identity() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading identity</div>;
  return <div>{user ? `${user.role}:${String(user.patient_onboarding_complete)}` : 'Sign in required'}</div>;
}

describe('restored account identity', () => {
  beforeEach(() => {
    get.mockReset(); getSession.mockReset(); localStorage.clear();
    getSession.mockReturnValue({ token: 'synthetic-token' });
    localStorage.setItem('ht_user', JSON.stringify({ role: 'doctor', patient_onboarding_complete: true }));
  });

  it('does not use cached privileges if the authoritative identity request fails', async () => {
    get.mockRejectedValue(new Error('Network unavailable'));
    render(<AuthProvider><Identity /></AuthProvider>);
    expect(await screen.findByText('Sign in required')).toBeInTheDocument();
    expect(screen.queryByText('doctor:true')).not.toBeInTheDocument();
  });

  it('restores server identity and onboarding state instead of cached values', async () => {
    get.mockResolvedValue({ data: { id: 'synthetic', email: 'patient@example.test', role: 'patient', patient_onboarding_complete: false } });
    render(<AuthProvider><Identity /></AuthProvider>);
    expect(await screen.findByText('patient:false')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('ht_user')!).role).toBe('patient');
  });
});
