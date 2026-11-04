import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import DoctorQueuePage from './DoctorQueuePage';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() }, getSession: () => ({ userId: 'doctor' }) }));
vi.mock('../components/PatientReadingsPanel', () => ({ default: () => <p>Private measurements</p> }));
vi.mock('../components/TriagePhotoReview', () => ({ default: () => <p>Private photographs</p> }));

const visit = { id: 'visit', patient_id: 'patient', patient_name: 'Queue patient', chief_complaint: 'Private complaint',
  specialty: 'clinica_geral', status: 'in_progress', triage_session_id: 'triage', reschedule_revision: 3,
  created_at: '2026-10-04T10:00:00Z' };
const escalation = { id: 'escalation', patient_id: 'other', patient_name: 'Escalation patient', reason: 'Private escalation reason',
  clinical_summary: 'Private escalation summary', urgency: 'high', status: 'pending', created_at: visit.created_at };
const closed = { consultation_id: visit.id, status: 'completed', closeout: { patient_summary: 'Private closeout summary',
  outcome: 'resolved', finalized_at: visit.created_at, finalized_by: 'doctor', follow_up_required: false,
  notes: { subjective: 'Private history', objective: null, assessment: 'Private assessment', plan: 'Private plan' } } };
const cursor = (config?: { params?: unknown }) => (config?.params as { cursor?: string } | undefined)?.cursor;
const show = () => render(<MemoryRouter><I18nProvider><DoctorQueuePage /></I18nProvider></MemoryRouter>);
beforeEach(() => vi.resetAllMocks());
async function openPanels() {
  fireEvent.click(await screen.findByText(visit.patient_name));
  await screen.findByText('Private measurements');
  fireEvent.click(screen.getAllByRole('button', { name: 'Concluir' })[0]);
  await screen.findByText('Private closeout summary');
}
function expectNoClinicalContent() {
  for (const text of [visit.patient_name, escalation.patient_name, escalation.clinical_summary,
    'Private measurements', 'Private photographs', 'Private closeout summary', 'Private assessment']) {
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
}

it.each([401, 403])('history denial (%s) tears down every sibling and ignores a late queue page after restoration', async status => {
  let restored = false; let finishQueue!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementation((path, config) => {
    if (path.includes('/escalations')) return Promise.resolve({ data: { items: restored ? [] : [escalation] } });
    if (path.endsWith('/doctor/consultations/page')) return Promise.reject({ response: { status } });
    if (path.endsWith('/closeout')) return Promise.resolve({ data: closed });
    if (cursor(config)) return new Promise(resolve => { finishQueue = resolve; });
    return Promise.resolve({ data: { items: restored ? [] : [visit], next_cursor: restored ? null : 'older' } });
  });
  show(); await openPanels();
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais consultas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ver histórico das minhas consultas' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('O acesso mudou');
  expectNoClinicalContent();
  restored = true; fireEvent.click(screen.getByRole('button', { name: 'Atualizar consultas' }));
  await screen.findByText(/0 consultas carregadas/);
  await act(async () => { finishQueue({ data: { items: [visit], next_cursor: null } }); });
  expectNoClinicalContent();
  expect(api.post).not.toHaveBeenCalled();
});

it.each([401, 403])('escalation denial (%s) clears the queue and rejects an already pending queue refresh', async status => {
  let escalationReads = 0; let queueReads = 0; let finishQueue!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementation(path => {
    if (path.includes('/escalations')) return escalationReads++ === 0
      ? Promise.resolve({ data: { items: [escalation] } }) : Promise.reject({ response: { status } });
    if (path.endsWith('/closeout')) return Promise.resolve({ data: closed });
    if (queueReads++ > 0) return new Promise(resolve => { finishQueue = resolve; });
    return Promise.resolve({ data: { items: [visit], next_cursor: null } });
  });
  show(); await openPanels();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar consultas' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('O acesso mudou');
  await act(async () => { finishQueue({ data: { items: [visit], next_cursor: null } }); });
  expectNoClinicalContent();
});

it.each([401, 403])('an opened closeout read denial (%s) removes the queue, escalation and clinical drawer', async status => {
  let closeoutReads = 0;
  vi.mocked(api.get).mockImplementation(async path => {
    if (path.includes('/escalations')) return { data: { items: [escalation] } };
    if (path.endsWith('/closeout')) {
      if (closeoutReads++ > 0) throw { response: { status } };
      return { data: closed };
    }
    return { data: { items: [visit], next_cursor: null } };
  });
  show(); await openPanels();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar registo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('O acesso mudou');
  expectNoClinicalContent();
});

it('preserves loaded clinical content and escalations when sibling refreshes fail transiently', async () => {
  let escalationReads = 0;
  vi.mocked(api.get).mockImplementation(async path => {
    if (path.includes('/escalations')) {
      if (escalationReads++ > 0) throw { response: { status: 503 } };
      return { data: { items: [escalation] } };
    }
    if (path.endsWith('/doctor/consultations/page')) throw { response: { status: 503 } };
    if (path.endsWith('/closeout')) return { data: closed };
    return { data: { items: [visit], next_cursor: null } };
  });
  show(); await openPanels();
  fireEvent.click(screen.getByRole('button', { name: 'Ver histórico das minhas consultas' }));
  await screen.findByText('Não foi possível carregar as consultas. Tente atualizar a lista.');
  expect(screen.getByText('Private closeout summary')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar consultas' }));
  await screen.findByText('Não foi possível carregar os encaminhamentos. Atualize a lista.');
  expect(screen.getByText(escalation.clinical_summary)).toBeInTheDocument();
  expect(screen.getByText('Private closeout summary')).toBeInTheDocument();
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path.endsWith('/closeout'))).toHaveLength(1);
});

it('finalization authority denial tears down the entire clinical scope without claiming success', async () => {
  vi.mocked(api.get).mockImplementation(async path => path.includes('/escalations') ? { data: { items: [escalation] } }
    : path.endsWith('/closeout') ? { data: { consultation_id: visit.id, status: 'in_progress', closeout: null } }
      : { data: { items: [visit], next_cursor: null } });
  vi.mocked(api.post).mockRejectedValue({ response: { status: 403 } });
  show(); fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }));
  await screen.findByLabelText('Avaliação clínica (interna)');
  for (const [label, value] of [['Avaliação clínica (interna)', 'Assessment draft'], ['Plano clínico (interno)', 'Plan draft'],
    ['Resumo para o paciente', 'Summary draft'], ['Resultado da consulta', 'resolved']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByLabelText('Revi o resumo e confirmo a conclusão desta consulta.'));
  fireEvent.click(screen.getByRole('button', { name: 'Concluir e publicar resumo' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('O acesso mudou'));
  expectNoClinicalContent();
  expect(screen.queryByText(/Consulta concluída e resumo publicado/)).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('Assessment draft')).not.toBeInTheDocument();
});
