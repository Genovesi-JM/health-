import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { User } from './types';
import { ProtectedRoute } from './ProtectedRoute';
import ClinicianPatientWorkspacePage from './pages/ClinicianPatientWorkspacePage';

const { get, auth } = vi.hoisted(() => ({ get: vi.fn(), auth: { user: {} as User, loading: false } }));
vi.mock('./api', () => ({ default: { get, post: vi.fn() } }));
vi.mock('./AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./i18n/LanguageContext', () => ({ useT: () => ({ lang: 'pt', t: (key: string) => key }) }));
vi.mock('./components/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./components/ChatWidget', () => ({ default: () => null }));
vi.mock('./components/LanguageSelector', () => ({ default: () => null }));

const workspace = {
  access: { role: 'doctor', scope: 'assigned_doctor', capabilities: {} },
  identity: { id: 'patient', name: 'Contexto anterior' },
  safety: { allergies: [], chronic_conditions: [], risk_flags: [] },
  consultations: [{ id: 'visit', specialty: 'Medicina geral', status: 'completed', messages_count: 0, can_read_closeout: true, can_amend: true }],
  active_episode: null, latest_triage: null, triages: [], readings: [], medications: [], prescriptions: [],
  prescription_requests: [], referrals: [], nursing_observations: [], care_tasks: [], care_escalations: [], consents: [], emergency_family: [],
};
const record = { consultation_id: 'visit', status: 'completed', closeout: {
  patient_summary: 'Clinical content from A', finalized_at: '2026-10-04T12:00:00Z', finalized_by: 'doctor-a', outcome: 'resolved',
  current_digest: 'a'.repeat(64), notes: { assessment: 'Assessment', plan: 'Plan' },
} };
function tree() {
  return <MemoryRouter initialEntries={['/clinician/patients/patient']}><Routes><Route element={<ProtectedRoute />}>
    <Route path="/clinician/patients/:patientId" element={<ClinicianPatientWorkspacePage />} />
  </Route></Routes></MemoryRouter>;
}
beforeEach(() => {
  get.mockReset();
  auth.user = { id: 'doctor-a', role: 'doctor', email: 'a@example.test', is_active: true };
});

it.each([{ id: 'doctor-b', role: 'doctor' }, { id: 'doctor-a', role: 'nurse' }] as const)(
  'discards loaded and pending clinical responses when authenticated identity becomes %j on the same path', async identity => {
    let finishOld!: (value: { data: typeof record }) => void;
    let finishCurrent!: (value: { data: typeof workspace }) => void;
    get.mockResolvedValueOnce({ data: workspace }).mockResolvedValueOnce({ data: record })
      .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishCurrent = resolve; }));
    const view = render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Consultas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir registo concluído · Medicina geral' }));
    await screen.findByText('Clinical content from A');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar registo' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    auth.user = { ...auth.user, ...identity };
    view.rerender(tree());
    expect(screen.queryByText('Clinical content from A')).not.toBeInTheDocument();
    expect(screen.queryByText('Contexto anterior')).not.toBeInTheDocument();
    await act(async () => finishOld({ data: { ...record, closeout: { ...record.closeout, patient_summary: 'Late confidential response from A' } } }));
    expect(screen.queryByText('Late confidential response from A')).not.toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(4));
    await act(async () => finishCurrent({ data: { ...workspace, identity: { ...workspace.identity, name: 'Current account context' },
      access: { ...workspace.access, role: identity.role }, consultations: [] } }));
    await screen.findByText('Current account context');
    fireEvent.click(screen.getByRole('button', { name: 'Consultas' }));
    expect(screen.queryByRole('button', { name: /Abrir registo concluído/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Late confidential response from A')).not.toBeInTheDocument();
  },
);
