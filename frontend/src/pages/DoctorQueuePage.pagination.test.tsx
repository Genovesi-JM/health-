import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import DoctorQueuePage from './DoctorQueuePage';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() }, getSession: () => ({ userId: 'doctor' }) }));
vi.mock('../components/PatientReadingsPanel', () => ({ default: () => <p>Private patient measurements</p> }));
vi.mock('../components/TriagePhotoReview', () => ({ default: () => <p>Private triage photographs</p> }));
vi.mock('../components/ConsultationCloseout', () => ({ default: () => <p>Private closeout content</p> }));

const visit = { id: 'visit', patient_id: 'patient', patient_name: 'Private patient name', chief_complaint: 'Private clinical complaint',
  specialty: 'clinica_geral', status: 'in_progress', triage_session_id: 'triage', reschedule_revision: 3, request_expiry_state: 'open', requested_expires_at: '2099-01-01T00:00:00Z',
  created_at: '2026-10-04T10:00:00Z' };
const escalation = { id: 'escalation', patient_id: 'other-patient', patient_name: 'Private escalation patient',
  reason: 'Private escalation reason', clinical_summary: 'Private escalation summary', urgency: 'high', status: 'pending', created_at: visit.created_at };
beforeEach(() => vi.resetAllMocks());
function show() { return render(<MemoryRouter><I18nProvider><DoctorQueuePage /></I18nProvider></MemoryRouter>); }
function cursorOf(config?: { params?: unknown }) { return (config?.params as { cursor?: string } | undefined)?.cursor; }
async function openClinicalPanels() {
  fireEvent.click(await screen.findByText(visit.patient_name));
  await screen.findByText('Private patient measurements');
  await screen.findByText('Private triage photographs');
  fireEvent.click(screen.getAllByRole('button', { name: 'Concluir' })[0]);
  await screen.findByText('Private closeout content');
}

it.each([401, 403])('removes every loaded clinical panel and escalation when a next-page request denies access (%s)', async status => {
  let rejectPage!: (failure: unknown) => void;
  let reads = 0;
  let escalationReads = 0;
  vi.mocked(api.get).mockImplementation((path, config) => {
    if (path.includes('/escalations')) return Promise.resolve({ data: { items: escalationReads++ === 0 ? [escalation] : [] } });
    if (cursorOf(config)) return new Promise((_resolve, reject) => { rejectPage = reject; });
    return Promise.resolve({ data: { items: reads++ === 0 ? [visit] : [], next_cursor: reads === 1 ? 'page-two' : null } });
  });
  show();
  await openClinicalPanels();
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais consultas' }));
  await waitFor(() => expect(rejectPage).toBeTypeOf('function'));
  await act(async () => { rejectPage({ response: { status } }); });
  expect(await screen.findByRole('alert')).toHaveTextContent('O acesso mudou');
  for (const text of [visit.patient_name, visit.chief_complaint, escalation.patient_name, escalation.clinical_summary,
    'Private patient measurements', 'Private triage photographs', 'Private closeout content']) {
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar consultas' }));
  await screen.findByText(/0 consultas carregadas/);
  expect(screen.queryByText('Private closeout content')).not.toBeInTheDocument();
  expect(screen.queryByText(escalation.clinical_summary)).not.toBeInTheDocument();
});

it('preserves loaded detail and closeout on a transient pagination failure and retries the same cursor', async () => {
  vi.mocked(api.get).mockImplementation(async (path, config) => {
    if (path.includes('/escalations')) return { data: { items: [escalation] } };
    if (cursorOf(config)) throw { response: { status: 503 } };
    return { data: { items: [visit], next_cursor: 'page-two' } };
  });
  show(); await openClinicalPanels();
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais consultas' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais');
  expect(screen.getByText('Private closeout content')).toBeInTheDocument();
  expect(screen.getByText('Private patient measurements')).toBeInTheDocument();
  expect(screen.getByText(escalation.clinical_summary)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais consultas' }));
  await waitFor(() => expect(vi.mocked(api.get).mock.calls.filter(([path, config]) => path === '/api/v1/doctor/queue/page' && cursorOf(config) === 'page-two')).toHaveLength(2));
  expect(api.post).not.toHaveBeenCalled();
});

it('never substitutes revision zero when an old queue response omitted the displayed revision', async () => {
  vi.mocked(api.get).mockImplementation(async path => ({ data: path.includes('/escalations') ? { items: [] } : {
    items: [{ ...visit, status: 'requested', reschedule_revision: undefined }], next_cursor: null,
  } }));
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Aceitar pedido' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar a versão');
  expect(api.post).not.toHaveBeenCalled();
});

it('retries a failed nursing-escalation request through the visible refresh action', async () => {
  let escalationReads = 0;
  vi.mocked(api.get).mockImplementation(async path => {
    if (path.includes('/escalations')) {
      if (escalationReads++ === 0) throw new Error('Transient escalation error');
      return { data: { items: [escalation] } };
    }
    return { data: { items: [visit], next_cursor: null } };
  });
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os encaminhamentos');
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar consultas' }));
  expect(await screen.findByText(escalation.clinical_summary)).toBeInTheDocument();
  expect(escalationReads).toBe(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('ignores a delayed escalation response after queue access was denied, including after access is restored', async () => {
  let finishEscalations!: (value: unknown) => void;
  let escalationReads = 0; let queueReads = 0;
  vi.mocked(api.get).mockImplementation(path => {
    if (path.includes('/escalations')) {
      if (escalationReads++ === 0) return new Promise(resolve => { finishEscalations = resolve; });
      return Promise.resolve({ data: { items: [] } });
    }
    if (queueReads++ === 0) return Promise.reject({ response: { status: 403 } });
    return Promise.resolve({ data: { items: [], next_cursor: null } });
  });
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('O acesso mudou');
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar consultas' }));
  await screen.findByText(/0 consultas carregadas/);
  await act(async () => { finishEscalations({ data: { items: [escalation] } }); });
  expect(screen.queryByText(escalation.clinical_summary)).not.toBeInTheDocument();
  expect(screen.queryByText(escalation.patient_name)).not.toBeInTheDocument();
});
