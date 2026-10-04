import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import DoctorConsultationHistory from './DoctorConsultationHistory';
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() }, getSession: () => ({ userId: 'doctor' }) }));
const old = { id: 'old-consultation', patient_id: 'patient', patient_name: 'Paciente anterior', status: 'completed', scheduled_at: '2025-01-10T10:00:00Z', timezone: 'Africa/Luanda' };
const closeout = { consultation_id: old.id, status: 'completed', closeout: { patient_summary: 'Resumo clínico anterior', follow_up_required: false,
  outcome: 'resolved', finalized_at: '2025-01-10T11:00:00Z', finalized_by: 'doctor', finalized_by_name: 'Dra. Exemplo',
  notes: { subjective: 'Queixa anterior', objective: 'Observações anteriores', assessment: 'Avaliação anterior', plan: 'Plano anterior' } } };
function show() { return render(<MemoryRouter><DoctorConsultationHistory /></MemoryRouter>); }
beforeEach(() => vi.resetAllMocks());

it('reaches an older completed record through pagination and reads its exact clinician closeout', async () => {
  vi.mocked(api.get).mockImplementation(async (url, options) => {
    if (url.endsWith('/closeout')) return { data: closeout };
    const cursor = (options?.params as { cursor?: string } | undefined)?.cursor;
    return { data: cursor ? { items: [old], next_cursor: null } : { items: [{ ...old, id: 'new', status: 'requested', patient_name: 'Paciente recente' }], next_cursor: 'older' } };
  });
  show(); await screen.findByText('Paciente recente');
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais registos' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ler registo concluído' }));
  await screen.findByText('Avaliação anterior');
  expect(api.get).toHaveBeenCalledWith('/api/v1/consultations/old-consultation/closeout');
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /correção/i })).not.toBeInTheDocument();
});

it('closes an older clinical record when its paginated history loses access', async () => {
  vi.mocked(api.get).mockImplementation(async url => url.endsWith('/closeout') ? { data: closeout } : { data: { items: [old], next_cursor: 'next' } });
  show(); fireEvent.click(await screen.findByRole('button', { name: 'Ler registo concluído' }));
  await screen.findByText('Avaliação anterior');
  vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais registos' }));
  await screen.findByText(/O acesso mudou/);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Paciente anterior')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' }));
  await screen.findByText('Paciente anterior');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('requests earlier visits from the server instead of filtering a truncated current page', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { items: [], next_cursor: null } });
  show(); await screen.findByText('Sem consultas nesta vista.');
  fireEvent.change(screen.getByLabelText('Mostrar consultas'), { target: { value: 'past' } });
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/doctor/consultations/page', { params: { limit: 20, view: 'past' } }));
});
