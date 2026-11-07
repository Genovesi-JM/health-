import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import ClinicianPatientWorkspacePage from './ClinicianPatientWorkspacePage';
import type { CloseoutRecord } from '../components/ConsultationCloseout';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../i18n/LanguageContext', () => ({ useT: () => ({ lang: 'pt' }) }));

const visit = { id: 'visit', specialty: 'Medicina geral', status: 'completed', created_at: '2026-10-04T12:00:00Z', messages_count: 0, can_read_closeout: true, can_amend: true, notes: { plan: 'Original visible plan' } };
const workspace = {
  access: { role: 'doctor', scope: 'completed_episode', capabilities: {} },
  identity: { id: 'patient', name: 'Paciente Exemplo' },
  safety: { allergies: [], chronic_conditions: [], risk_flags: [] },
  consultations: [visit], active_episode: null, latest_triage: null,
  triages: [], readings: [], medications: [], prescriptions: [], prescription_requests: [], referrals: [],
  nursing_observations: [], care_tasks: [], care_escalations: [], consents: [], emergency_family: [],
};
const record: CloseoutRecord = { consultation_id: 'visit', status: 'completed', closeout: {
  patient_summary: 'Resumo assinado', follow_up_instructions: null, follow_up_required: false, outcome: 'resolved',
  finalized_at: '2026-10-04T12:00:00Z', finalized_by: 'doctor', follow_up: null,
  current_digest: 'a'.repeat(64), current_revision: 0, current_is_published: true,
  notes: { subjective: null, objective: null, assessment: 'Avaliação', plan: 'Plano' },
} };
function show(data = workspace) {
  vi.mocked(api.get).mockImplementation(async path => ({ data: path.endsWith('/360') ? data : record }));
  render(<MemoryRouter initialEntries={['/clinician/patients/patient']}><Routes>
    <Route path="/clinician/patients/:patientId" element={<ClinicianPatientWorkspacePage />} />
  </Routes></MemoryRouter>);
}
async function openConsultations() { fireEvent.click(await screen.findByRole('button', { name: 'Consultas' })); }
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());

it('opens a completed signed record and its correction editor without an active episode', async () => {
  show(); await openConsultations();
  expect(screen.queryByText('Resumo assinado')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir registo concluído · Medicina geral' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar correção' }));
  expect(screen.getByLabelText('Resumo corrigido para o paciente')).toHaveValue('Resumo assinado');
  expect(api.get).toHaveBeenCalledWith('/api/v1/consultations/visit/closeout');
  expect(api.post).not.toHaveBeenCalled();
});

it.each([
  { role: 'nurse', can_read_closeout: true },
  { role: 'doctor', can_read_closeout: false },
  { role: 'doctor', can_read_closeout: undefined },
])('does not offer record access outside explicit doctor permission (%j)', async ({ role, can_read_closeout }) => {
  show({ ...workspace, access: { ...workspace.access, role }, consultations: [{ ...visit, can_read_closeout: can_read_closeout as boolean }] });
  await openConsultations();
  expect(screen.queryByRole('button', { name: /Abrir registo concluído/ })).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});

it('allows signed record reading without offering an unauthorized amendment', async () => {
  show({ ...workspace, consultations: [{ ...visit, can_amend: false }] }); await openConsultations();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir registo concluído · Medicina geral' }));
  await screen.findByText('Resumo assinado');
  expect(screen.queryByRole('button', { name: 'Adicionar correção' })).not.toBeInTheDocument();
});

it('keeps a correction draft when the doctor dismisses the record-close confirmation', async () => {
  show(); await openConsultations();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir registo concluído · Medicina geral' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar correção' }));
  fireEvent.change(screen.getByLabelText('Motivo da correção (interno)'), { target: { value: 'Preserved reason' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Fechar registo concluído' }));
  expect(confirm).toHaveBeenCalled();
  expect(screen.getByLabelText('Motivo da correção (interno)')).toHaveValue('Preserved reason');
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Fechar registo concluído' }));
  await waitFor(() => expect(screen.queryByText('Resumo assinado')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Abrir registo concluído · Medicina geral' }));
  expect(await screen.findByRole('button', { name: 'Adicionar correção' })).toBeEnabled();
});

it('updates the consultation card plan only from the acknowledged amendment', async () => {
  show(); await openConsultations();
  const open = screen.getByRole('button', { name: 'Abrir registo concluído · Medicina geral' });
  const card = open.closest('article')!;
  fireEvent.click(open);
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar correção' }));
  fireEvent.change(screen.getByLabelText('Motivo da correção (interno)'), { target: { value: 'Reviewed plan' } });
  fireEvent.change(screen.getByLabelText('Plano corrigido (interno)'), { target: { value: 'Updated displayed plan' } });
  expect(card).toHaveTextContent('Original visible plan');
  expect(card).not.toHaveTextContent('Updated displayed plan');
  vi.mocked(api.post).mockResolvedValue({ data: { ...record, closeout: { ...record.closeout!, current_digest: 'b'.repeat(64), current_is_published: false,
    notes: { ...record.closeout!.notes!, plan: 'Updated displayed plan' } } } });
  fireEvent.click(screen.getByLabelText('Revi o registo atual e confirmo esta correção.'));
  fireEvent.click(screen.getByRole('button', { name: 'Registar correção' }));
  await screen.findByText('Correção interna registada. O resumo publicado para o paciente mantém-se.');
  expect(card).toHaveTextContent('Updated displayed plan');
  expect(card).not.toHaveTextContent('Original visible plan');
});

it('opens doctor document access from the patient workspace and loads a selected original on demand', async () => {
  show();
  const tab = await screen.findByRole('button', { name: 'Documentos' });
  const metadata = { id: 'document', original_filename: 'Exame.pdf', content_type: 'application/pdf', size_bytes: 100, scan_status: 'clean', status: 'confirmed', created_at: '2026-10-04T12:00:00Z' };
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/page')
    ? { items: [metadata], next_cursor: null } : { ...metadata, reviewed_text: 'Patient document text' } }));
  fireEvent.click(tab);
  fireEvent.click(await screen.findByRole('button', { name: /Exame.pdf/ }));
  await screen.findByText('Patient document text');
  expect(api.get).toHaveBeenCalledWith('/api/v1/patient-documents/patients/patient/page', { params: { limit: 20 } });
  expect(api.get).toHaveBeenLastCalledWith('/api/v1/patient-documents/document');
  expect(api.post).not.toHaveBeenCalled();
});

it('keeps document access out of the nursing workspace', async () => {
  show({ ...workspace, access: { ...workspace.access, role: 'nurse' } });
  await screen.findByText('Paciente Exemplo');
  expect(screen.queryByRole('button', { name: 'Documentos' })).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});
