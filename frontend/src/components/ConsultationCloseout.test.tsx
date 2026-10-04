import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ConsultationCloseout from './ConsultationCloseout';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const path = '/api/v1/consultations/visit-1';
const completed = { consultation_id: 'visit-1', status: 'completed', closeout: {
  patient_summary: 'Resumo publicado', follow_up_instructions: 'Telefonar à equipa', follow_up_required: true,
  outcome: 'follow_up', finalized_at: '2026-10-04T12:00:00Z', finalized_by: 'doctor-1', finalized_by_name: 'Dra. Ana',
  follow_up: { id: 'task-1', assigned_user_id: 'doctor-1', assigned_name: 'Dra. Ana', due_at: '2026-10-06T12:00:00Z', status: 'pending' },
  notes: { subjective: 'História interna', objective: 'Exame interno', assessment: 'Avaliação interna', plan: 'Plano interno' },
} };
const open = { consultation_id: 'visit-1', status: 'in_progress', closeout: null };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.get).mockResolvedValue({ data: open }); });
async function show() { render(<ConsultationCloseout consultationId="visit-1" role="doctor" />); await screen.findByLabelText('Avaliação clínica (interna)'); }
function enter(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
function draft() {
  enter('Avaliação clínica (interna)', '  Avaliação interna  '); enter('Plano clínico (interno)', 'Plano interno');
  enter('Resumo para o paciente', 'Resumo publicado'); enter('Resultado da consulta', 'resolved');
}
function confirm() { fireEvent.click(screen.getByLabelText('Revi o resumo e confirmo a conclusão desta consulta.')); }
function save() { fireEvent.click(screen.getByRole('button', { name: 'Concluir e publicar resumo' })); }

describe('clinical closeout and shared summary', () => {
  it('publishes only the patient view even if a response contains internal notes', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: completed });
    render(<ConsultationCloseout consultationId="visit-1" role="patient" />);
    await screen.findByText('Resumo publicado');
    expect(screen.getByText('Telefonar à equipa')).toBeInTheDocument();
    expect(screen.getByText(/Acompanhamento:/).parentElement).toHaveTextContent('Dra. Ana');
    expect(screen.queryByText('Avaliação interna')).not.toBeInTheDocument();
    expect(screen.queryByText('Notas clínicas internas')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Concluir e publicar resumo' })).not.toBeInTheDocument();
  });
  it('keeps a failed read distinct from a missing published summary and allows retry', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ data: completed });
    render(<ConsultationCloseout consultationId="visit-1" role="patient" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    expect(screen.queryByText(/ainda não tem um resumo/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar registo' })); await screen.findByText('Resumo publicado');
  });
  it('does not invent a summary for legacy completed consultations', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...open, status: 'completed' } });
    render(<ConsultationCloseout consultationId="visit-1" role="patient" />);
    expect(await screen.findByText('Esta consulta ainda não tem um resumo publicado.')).toBeInTheDocument();
  });
  it('requires a deliberate outcome and final confirmation without generating clinical text', async () => {
    await show();
    expect(screen.getByLabelText('Resultado da consulta')).toHaveValue('');
    expect(screen.getByLabelText('Avaliação clínica (interna)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Concluir e publicar resumo' })).toBeDisabled();
    draft(); confirm();
    enter('Resumo para o paciente', 'Correção');
    expect(screen.getByLabelText('Revi o resumo e confirmo a conclusão desta consulta.')).not.toBeChecked();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('saves the explicit clinical and shared text and only then reports publication', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'completed' } });
    await show(); draft(); confirm(); vi.mocked(api.get).mockResolvedValue({ data: completed }); save();
    await screen.findByText('Consulta concluída e resumo publicado para o paciente.');
    expect(api.post).toHaveBeenCalledWith(`${path}/complete`, {
      subjective: null, objective: null, assessment: 'Avaliação interna', plan: 'Plano interno', patient_summary: 'Resumo publicado',
      outcome: 'resolved', follow_up_required: false, follow_up_instructions: null, follow_up_due_at: null,
    });
  });
  it('preserves a failed submission and replays exactly the same payload', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce({ data: { status: 'completed' } });
    await show(); draft(); confirm(); save(); await screen.findByRole('alert');
    expect(screen.getByLabelText('Resumo para o paciente')).toHaveValue('Resumo publicado');
    expect(screen.queryByText('Consulta concluída e resumo publicado para o paciente.')).not.toBeInTheDocument();
    vi.mocked(api.get).mockResolvedValue({ data: completed }); save(); await screen.findByText('Consulta concluída e resumo publicado para o paciente.');
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(vi.mocked(api.post).mock.calls[1]);
  });
  it('preserves the draft beside a conflicting finalized record without allowing an overwrite', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409 } });
    await show(); draft(); enter('Resumo para o paciente', 'Meu rascunho'); confirm();
    vi.mocked(api.get).mockResolvedValue({ data: completed }); save();
    expect(await screen.findByRole('alert')).toHaveTextContent('O seu rascunho foi preservado');
    expect(screen.getByLabelText('Resumo para o paciente')).toHaveValue('Meu rascunho');
    expect(screen.getByText('Resumo publicado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concluir e publicar resumo' })).toBeDisabled();
  });
  it('requires future follow-up instructions and serializes local time as an ISO instant', async () => {
    await show(); draft(); enter('Resultado da consulta', 'follow_up');
    expect(screen.getByLabelText('Criar tarefa de acompanhamento sob a minha responsabilidade')).toBeChecked();
    expect(screen.getByLabelText('Criar tarefa de acompanhamento sob a minha responsabilidade')).toBeDisabled();
    enter('Instruções de acompanhamento', 'Reavaliar'); enter('Data e hora limite do acompanhamento (hora local)', '2020-01-01T12:00'); confirm(); save();
    expect(await screen.findByRole('alert')).toHaveTextContent('uma data futura'); expect(api.post).not.toHaveBeenCalled();
    enter('Data e hora limite do acompanhamento (hora local)', '2099-01-01T12:00'); confirm();
    vi.mocked(api.post).mockResolvedValue({ data: {} }); save();
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ follow_up_required: true, follow_up_instructions: 'Reavaliar', follow_up_due_at: new Date('2099-01-01T12:00').toISOString() });
  });
  it('does not claim a failed reload undid an acknowledged closeout', async () => {
    await show(); draft(); confirm(); vi.mocked(api.post).mockResolvedValue({ data: {} }); vi.mocked(api.get).mockRejectedValue(new Error('Offline')); save();
    expect(await screen.findByRole('alert')).toHaveTextContent('Consulta concluída');
    expect(screen.getByText('Consulta concluída e resumo publicado para o paciente.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Concluir e publicar resumo' })).not.toBeInTheDocument();
  });
  it('can replay a lost response after the submitted follow-up deadline has passed', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(new Date('2098-01-01T12:00:00Z').getTime());
    try {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Lost')).mockResolvedValueOnce({ data: {} });
      await show(); draft(); enter('Resultado da consulta', 'follow_up'); enter('Instruções de acompanhamento', 'Rever');
      enter('Data e hora limite do acompanhamento (hora local)', '2099-01-01T12:00'); confirm(); save(); await screen.findByRole('alert');
      now.mockReturnValue(new Date('2100-01-01T12:00:00Z').getTime());
      vi.mocked(api.get).mockResolvedValue({ data: completed }); save(); await screen.findByText('Consulta concluída e resumo publicado para o paciente.');
      expect(vi.mocked(api.post).mock.calls[0]).toEqual(vi.mocked(api.post).mock.calls[1]);
    } finally { now.mockRestore(); }
  });
  it.each([403, 409])('clears an earlier published record on access or integrity failure (%s)', async status => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: completed }).mockRejectedValueOnce({ response: { status } });
    render(<ConsultationCloseout consultationId="visit-1" role="patient" />); await screen.findByText('Resumo publicado');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar registo' })); await screen.findByRole('alert');
    expect(screen.queryByText('Resumo publicado')).not.toBeInTheDocument();
  });
  it('does not mix drafts or old responses when switching patients', async () => {
    const view = render(<ConsultationCloseout consultationId="visit-1" role="doctor" />);
    await screen.findByLabelText('Avaliação clínica (interna)'); draft();
    vi.mocked(api.get).mockResolvedValue({ data: { ...open, consultation_id: 'visit-2' } });
    view.rerender(<ConsultationCloseout consultationId="visit-2" role="doctor" />);
    await waitFor(() => expect(screen.getByLabelText('Avaliação clínica (interna)')).toHaveValue(''));
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/consultations/visit-2/closeout');
  });
});
