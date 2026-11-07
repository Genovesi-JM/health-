import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/LanguageContext';
import api from '../api';
import ProfessionalVerificationPage from './ProfessionalVerificationPage';

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: { role: 'patient' }, logout }) }));
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const application = { profession: 'doctor', legal_name: 'Test applicant', status: 'draft',
  automated_score: 0, practice_country: 'AO', licence_country: 'AO', diploma_country: 'AO',
  licence_number: 'TEST-123', issuing_authority: 'Test authority', evidence: [],
  missing_evidence: ['diploma', 'professional_card'], automated_checks: [], provider_checks: [] };

function show() {
  render(<I18nProvider><MemoryRouter initialEntries={['/professional-verification']}><Routes>
    <Route path="/professional-verification" element={<ProfessionalVerificationPage />} />
    <Route path="/login" element={<div>Fresh sign-in</div>} />
    <Route path="/dashboard" element={<div>Patient dashboard</div>} />
  </Routes></MemoryRouter></I18nProvider>);
}
beforeEach(() => vi.clearAllMocks());

it('allows a non-clinical applicant to see their application and upload controls', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: application });
  show();
  await screen.findByText(/Test applicant/);
  expect(screen.queryByText('Patient dashboard')).not.toBeInTheDocument();
  expect(screen.getByText('Documentos obrigatórios')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submeter para revisão' })).toBeDisabled();
});

it('requires fresh sign-in after approval rather than entering a clinical dashboard with an applicant session', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { ...application, status: 'verified' } });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Entrar para concluir o acesso profissional' }));
  expect(logout).toHaveBeenCalledTimes(1);
  await screen.findByText('Fresh sign-in');
});

it('does not offer resubmission of a revoked application', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { ...application, status: 'revoked' } });
  show();
  await waitFor(() => expect(screen.getByText('Acesso profissional revogado')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Submeter para revisão' })).not.toBeInTheDocument();
});
