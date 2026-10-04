import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import ConsultationAmendments from './ConsultationAmendments';
import ConsultationCloseout, { type Closeout, type CloseoutRecord } from './ConsultationCloseout';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const closeout: Closeout = {
  patient_summary: 'Original published summary', follow_up_instructions: null, follow_up_required: false,
  outcome: 'resolved', finalized_at: '2026-10-04T12:00:00Z', finalized_by: 'doctor', finalized_by_name: 'Doctor',
  follow_up: null, current_revision: 0, current_digest: 'a'.repeat(64), current_is_published: true,
  notes: { subjective: null, objective: null, assessment: 'Original assessment', plan: 'Original plan' },
};
const original: CloseoutRecord = { consultation_id: 'visit', status: 'completed', closeout };
const updated: CloseoutRecord = { ...original, closeout: { ...closeout, current_revision: 1,
  current_digest: 'b'.repeat(64), current_is_published: false, patient_summary: 'Corrected internal summary' } };

function prepare() {
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar correção' }));
  fireEvent.change(screen.getByLabelText('Motivo da correção (interno)'), { target: { value: 'Correction reason' } });
  fireEvent.change(screen.getByLabelText('Resumo corrigido para o paciente'), { target: { value: 'Corrected internal summary' } });
  fireEvent.click(screen.getByLabelText('Revi o registo atual e confirmo esta correção.'));
}
beforeEach(() => vi.resetAllMocks());

it.each([400, 401, 403, 404, 409, 422])('retains exact uncertain request through a later pre-replay rejection (%s)', async status => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Response lost'))
    .mockRejectedValueOnce({ response: { status } }).mockResolvedValueOnce({ data: updated });
  const onUpdated = vi.fn();
  render(<ConsultationAmendments consultationId="visit" closeout={closeout} onUpdated={onUpdated} onBusyChange={vi.fn()} onDirtyChange={vi.fn()} />);
  prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Registar correção' }));
  await screen.findByRole('button', { name: 'Repetir o mesmo envio' });
  fireEvent.click(screen.getByRole('button', { name: 'Repetir o mesmo envio' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Repetir o mesmo envio' })).toBeEnabled());
  expect(screen.getByLabelText('Motivo da correção (interno)')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Repetir o mesmo envio' }));
  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  const calls = vi.mocked(api.post).mock.calls;
  expect(calls[1]).toEqual(calls[0]);
  expect(calls[2]).toEqual(calls[0]);
});

it('does not replace an acknowledged amendment with an older in-flight refresh response', async () => {
  let finishRefresh!: (value: { data: CloseoutRecord }) => void;
  vi.mocked(api.get).mockResolvedValueOnce({ data: original })
    .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  vi.mocked(api.post).mockResolvedValue({ data: updated });
  render(<ConsultationCloseout consultationId="visit" role="doctor" />);
  await screen.findByRole('button', { name: 'Adicionar correção' });
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar registo' }));
  prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Registar correção' }));
  await screen.findByText('Corrected internal summary');
  await act(async () => finishRefresh({ data: original }));
  expect(screen.getByText('Corrected internal summary')).toBeInTheDocument();
});

it('unlocks an uncertain request only after the server verifies its key never committed', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: original }).mockResolvedValue({ data: updated });
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Response lost'))
    .mockRejectedValueOnce({ response: { status: 409, data: { detail: {
      code: 'amendment_stale_head', request_key_committed: false,
    } } } }).mockResolvedValueOnce({ data: updated });
  render(<ConsultationCloseout consultationId="visit" role="doctor" />);
  await screen.findByRole('button', { name: 'Adicionar correção' });
  prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Registar correção' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Repetir o mesmo envio' }));
  const review = await screen.findByRole('button', { name: 'Revi a versão atual; manter o meu rascunho' });
  expect(screen.getByLabelText('Motivo da correção (interno)')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Registar correção' })).toBeDisabled();
  fireEvent.click(review);
  fireEvent.click(screen.getByLabelText('Revi o registo atual e confirmo esta correção.'));
  fireEvent.click(screen.getByRole('button', { name: 'Registar correção' }));
  await screen.findByText('Correção interna registada. O resumo publicado para o paciente mantém-se.');
  const calls = vi.mocked(api.post).mock.calls;
  expect(calls[1]).toEqual(calls[0]);
  expect(calls[2][2]).not.toEqual(calls[0][2]);
  expect(calls[2][1]).toMatchObject({ expected_digest: updated.closeout!.current_digest, reason: 'Correction reason' });
});
