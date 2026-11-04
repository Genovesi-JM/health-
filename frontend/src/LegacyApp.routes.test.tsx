import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { User } from './types';
import App from './LegacyApp';

const state = vi.hoisted(() => ({
  auth: { user: null as User | null, loading: false }, get: vi.fn(), documentsLoaded: vi.fn(),
  resolveAbout: (() => {}) as () => void,
}));
vi.mock('./AuthContext', () => ({ useAuth: () => state.auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('./api', () => ({ default: { get: state.get } }));
vi.mock('./components/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./components/ChatWidget', () => ({ default: () => null }));
vi.mock('./components/LanguageSelector', () => ({ default: () => null }));
vi.mock('./components/InstallPrompt', () => ({ default: () => null }));
vi.mock('./pages/AboutPage', async () => {
  await new Promise<void>(resolve => { state.resolveAbout = resolve; });
  return { default: () => <h1>About route loaded</h1> };
});
vi.mock('./pages/LoginPage', () => ({ default: () => <h1>Login route</h1> }));
vi.mock('./pages/DoctorDashboardPage', () => ({ default: () => <h1>Doctor dashboard route</h1> }));
vi.mock('./pages/PatientDocumentsPage', () => {
  state.documentsLoaded(); return { default: () => <h1>Private documents route</h1> };
});
vi.mock('./pages/NurseDashboardPreviewShell', () => ({ default: () => <h1>Nurse preview route</h1> }));
vi.mock('./pages/ClinicianPatientWorkspacePage', () => ({ default: ({ preview }: { preview?: boolean }) => <h1>{preview ? 'Clinician preview route' : 'Clinical workspace route'}</h1> }));
vi.mock('./pages/ServicesPage', async () => { throw new Error('Synthetic route module download failure'); });

beforeEach(() => {
  state.auth.user = null; state.auth.loading = false; state.get.mockReset();
  window.history.replaceState(null, '', '/');
  state.get.mockResolvedValue({ data: ['terms_of_service', 'privacy_policy', 'medical_disclaimer', 'health_data_processing', 'telemedicine_consent'].map(consent_type => ({ consent_type })) });
});

it('shows an accessible fallback until the selected public route module arrives', async () => {
  window.history.replaceState(null, '', '/about'); render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('A carregar página');
  await waitFor(() => expect(state.resolveAbout).not.toBeUndefined());
  await act(async () => { state.resolveAbout(); });
  expect(await screen.findByRole('heading', { name: 'About route loaded' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('redirects signed-out and wrong-role deep links before loading private page code', async () => {
  window.history.replaceState(null, '', '/patient/documents'); const signedOut = render(<App />);
  await screen.findByRole('heading', { name: 'Login route' });
  expect(state.documentsLoaded).not.toHaveBeenCalled(); signedOut.unmount();
  state.auth.user = { id: 'doctor', role: 'doctor', email: 'doctor@example.test', is_active: true };
  window.history.replaceState(null, '', '/patient/documents'); render(<App />);
  await screen.findByRole('heading', { name: 'Doctor dashboard route' });
  expect(state.documentsLoaded).not.toHaveBeenCalled();
});

it('keeps a personal document deep link accessible without a global consent gate', async () => {
  state.auth.user = { id: 'patient', role: 'patient', email: 'patient@example.test', is_active: true, patient_onboarding_complete: true };
  window.history.replaceState(null, '', '/patient/documents'); render(<App />);
  await screen.findByRole('heading', { name: 'Private documents route' });
  expect(state.get).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe('/patient/documents');
});

it.each(['/preview/nurse', '/preview/clinician/patient'])('preserves the development preview route %s without auth', async path => {
  window.history.replaceState(null, '', path); render(<App />);
  await screen.findByRole('heading', { name: path.endsWith('nurse') ? 'Nurse preview route' : 'Clinician preview route' });
  expect(state.get).not.toHaveBeenCalled();
});

it('shows an actionable page-loading failure and a safe reload target', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    window.history.replaceState(null, '', '/services'); render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível abrir esta página');
    expect(screen.getByRole('button', { name: 'Recarregar página' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  } finally { consoleError.mockRestore(); }
});
