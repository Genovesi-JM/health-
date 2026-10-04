import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ConsultationCloseout, { type CloseoutRecord } from './ConsultationCloseout';
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const digest = 'a'.repeat(64), nextDigest = 'b'.repeat(64);
const original = { patient_summary: 'Resumo original', notes: { subjective: 'História interna', objective: null, assessment: 'Avaliação anterior', plan: 'Plano anterior' } };
const record: CloseoutRecord = { consultation_id: 'visit-1', status: 'completed', closeout: {
  ...original, outcome: 'resolved', finalized_at: '2026-10-04T12:00:00Z', finalized_by: 'doctor-1', follow_up: null, follow_up_instructions: null, follow_up_required: false, original,
  current_revision: 0, current_digest: digest, current_is_published: true, published_revision: 0,
  published_history: [{ revision: 0, patient_summary: original.patient_summary, published_at: '2026-10-04T12:00:00Z', author_name: 'Dra. Ana' }], amendments: [],
} };
const updated: CloseoutRecord = { ...record, closeout: { ...record.closeout!, current_revision: 1, current_digest: nextDigest, current_is_published: false, patient_summary: 'Resumo corrigido', amendments: [{ id: 'a1', revision: 1, created_at: '2026-10-04T13:00:00Z', author_name: 'Dra. Ana', reason: 'Motivo interno', publish_to_patient: false, digest: nextDigest, previous_digest: digest, patient_summary: 'Resumo corrigido', notes: { ...original.notes, assessment: 'Avaliação corrigida' } }] } };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.get).mockResolvedValue({ data: record }); });
async function show() { render(<ConsultationCloseout consultationId="visit-1" role="doctor" />); fireEvent.click(await screen.findByRole('button', { name: 'Adicionar correção' })); }
function enter(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
function fill() { enter('Motivo da correção (interno)', '  Motivo interno  '); enter('Avaliação corrigida (interna)', 'Avaliação corrigida'); enter('Resumo corrigido para o paciente', 'Resumo corrigido'); }
function confirm() { fireEvent.click(screen.getByLabelText('Revi o registo atual e confirmo esta correção.')); }
function save() { fireEvent.click(screen.getByRole('button', { name: 'Registar correção' })); }
const savedMessage = 'Correção interna registada. O resumo publicado para o paciente mantém-se.';

describe('append-only clinical corrections', () => {
  it('requires confirmation and keeps patient publication an explicit choice', async () => {
    await show();
    expect(screen.getByLabelText('Publicar este resumo corrigido para o paciente')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Registar correção' })).toBeDisabled();
    fill(); confirm(); enter('Plano corrigido (interno)', 'Plano revisto');
    expect(screen.getByLabelText('Revi o registo atual e confirmo esta correção.')).not.toBeChecked();
    confirm(); vi.mocked(api.post).mockResolvedValue({ data: updated }); save(); await screen.findByText(savedMessage);
    expect(api.post).toHaveBeenCalledWith('/api/v1/consultations/visit-1/closeout/amendments', {
      expected_digest: digest, reason: 'Motivo interno', publish_to_patient: false, subjective: 'História interna', objective: null,
      assessment: 'Avaliação corrigida', plan: 'Plano revisto', patient_summary: 'Resumo corrigido',
    }, { headers: { 'Idempotency-Key': expect.stringMatching(/^[a-f0-9-]{36}$/) } });
    expect(screen.getByText('Registo original assinado').parentElement).toHaveTextContent('Resumo original');
  });
  it('reserves an uncertain request and retries its exact identity and content', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Lost')).mockResolvedValueOnce({ data: updated });
    await show(); fill(); confirm(); save(); await screen.findByText(/Não foi possível confirmar o envio/);
    expect(screen.getByLabelText('Resumo corrigido para o paciente')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar correção' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Repetir o mesmo envio' })); await screen.findByText(savedMessage);
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(vi.mocked(api.post).mock.calls[1]);
  });
  it('preserves stale text and requires deliberate version review and reconfirmation', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValueOnce({ data: updated });
    await show(); fill(); confirm(); vi.mocked(api.get).mockResolvedValue({ data: updated }); save();
    const review = await screen.findByRole('button', { name: 'Revi a versão atual; manter o meu rascunho' });
    expect(screen.getByLabelText('Resumo corrigido para o paciente')).toHaveValue('Resumo corrigido');
    expect(screen.getByRole('button', { name: 'Registar correção' })).toBeDisabled();
    fireEvent.click(review); expect(screen.getByRole('button', { name: 'Registar correção' })).toBeDisabled();
    confirm(); save(); await screen.findByText(savedMessage);
    const calls = vi.mocked(api.post).mock.calls;
    expect(calls[1][1]).toMatchObject({ expected_digest: nextDigest, patient_summary: 'Resumo corrigido' });
    expect(calls[1][2]).not.toEqual(calls[0][2]);
  });
  it('never renders private correction fields in the patient view', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...updated, closeout: {
      ...updated.closeout!, patient_summary: 'Resumo publicado para paciente', published_revision: 1,
      published_history: [...record.closeout!.published_history!, { revision: 1, patient_summary: 'Resumo publicado para paciente', published_at: '2026-10-04T13:00:00Z', author_name: 'Dra. Ana' }],
    } } });
    render(<ConsultationCloseout consultationId="visit-1" role="patient" />); await screen.findByText('Histórico dos resumos publicados');
    for (const text of ['Motivo interno', 'Avaliação corrigida', 'História interna']) expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar correção' })).not.toBeInTheDocument();
    expect(screen.getByText(/Correção publicada 1/)).toBeInTheDocument();
  });
  it('ignores late replies after changing consultations', async () => {
    let resolve!: (value: { data: CloseoutRecord }) => void;
    vi.mocked(api.post).mockReturnValue(new Promise(r => { resolve = r; }));
    const view = render(<ConsultationCloseout consultationId="visit-1" role="doctor" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar correção' })); fill(); confirm(); save();
    vi.mocked(api.get).mockResolvedValue({ data: { ...record, consultation_id: 'visit-2', closeout: { ...record.closeout!, patient_summary: 'Outro paciente' } } });
    view.rerender(<ConsultationCloseout consultationId="visit-2" role="doctor" />); await screen.findByText('Outro paciente'); resolve({ data: updated });
    await waitFor(() => expect(screen.queryByText('Resumo corrigido')).not.toBeInTheDocument());
    expect(screen.getByText('Outro paciente')).toBeInTheDocument();
  });
  it('does not offer corrections for unsigned historical notes', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...record, closeout: { ...record.closeout!, current_digest: undefined } } });
    render(<ConsultationCloseout consultationId="visit-1" role="doctor" />);
    await screen.findByText('Não é possível corrigir este registo até confirmar a sua versão assinada.');
    expect(screen.queryByRole('button', { name: 'Adicionar correção' })).not.toBeInTheDocument();
  });
});
