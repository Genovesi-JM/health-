import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

function SessionControls() {
  const { user, loading, logout, login, refreshUser } = useAuth();
  return <><p>{loading ? 'Pending identity' : user?.email || 'Signed out'}</p>
    <button onClick={logout}>Sign out now</button>
    <button onClick={() => login({ access_token: 'new-token', user: { id: 'new-user', email: 'new@example.test', role: 'patient', is_active: true } })}>Use new account</button>
    <button onClick={() => { void refreshUser().catch(() => {}); }}>Refresh identity</button>
  </>;
}

describe('stale account responses', () => {
  beforeEach(() => { get.mockReset(); getSession.mockReset(); localStorage.clear(); getSession.mockReturnValue({ token: 'old-token' }); });
  it('does not restore a logged-out account from a late startup response', async () => {
    let resolve!: (value: unknown) => void;
    get.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<AuthProvider><SessionControls /></AuthProvider>);
    fireEvent.click(screen.getByText('Sign out now'));
    await act(async () => { resolve({ data: { id: 'old-user', email: 'old@example.test', role: 'doctor' } }); });
    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(localStorage.getItem('ht_user')).toBeNull();
  });
  it('does not overwrite a new account with an old in-flight profile refresh', async () => {
    get.mockResolvedValueOnce({ data: { id: 'old-user', email: 'old@example.test', role: 'patient' } });
    render(<AuthProvider><SessionControls /></AuthProvider>); await screen.findByText('old@example.test');
    let resolve!: (value: unknown) => void;
    get.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    fireEvent.click(screen.getByText('Refresh identity')); fireEvent.click(screen.getByText('Use new account'));
    await act(async () => { resolve({ data: { id: 'old-user', email: 'old@example.test', role: 'doctor' } }); });
    expect(screen.getByText('new@example.test')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('ht_user')!).id).toBe('new-user');
  });
});

it('removes the prior account immediately when another tab changes or clears the token', async () => {
  get.mockReset(); getSession.mockReset(); localStorage.clear();
  getSession.mockReturnValue({ token: 'old-token' });
  get.mockResolvedValueOnce({ data: { id: 'old-user', email: 'old@example.test', role: 'patient' } });
  render(<AuthProvider><SessionControls /></AuthProvider>); await screen.findByText('old@example.test');
  let resolve!: (value: unknown) => void;
  get.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  getSession.mockReturnValue({ token: 'other-tab-token' });
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'ht_token' })); });
  expect(screen.queryByText('old@example.test')).not.toBeInTheDocument();
  expect(screen.getByText('Pending identity')).toBeInTheDocument();
  getSession.mockReturnValue(null);
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: null })); });
  await act(async () => { resolve({ data: { id: 'other-user', email: 'other@example.test', role: 'doctor' } }); });
  expect(screen.getByText('Signed out')).toBeInTheDocument();
  expect(screen.queryByText('other@example.test')).not.toBeInTheDocument();
});
