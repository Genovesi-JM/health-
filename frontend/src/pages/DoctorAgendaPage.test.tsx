import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../api';
import DoctorAgendaPage from './DoctorAgendaPage';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: [{
    id: 'consult-1', time: '10:00', patient: 'Paciente de teste',
    type: 'teleconsulta', reason: 'Pedido de teste', status: 'pending',
  }] });
});

function renderAgenda() {
  return render(<MemoryRouter><DoctorAgendaPage /></MemoryRouter>);
}

describe('doctor agenda persistence', () => {
  it('uses explicit backend acceptance and its returned state', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'scheduled' } });
    renderAgenda();
    await userEvent.click(await screen.findByTitle('Confirmar'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/doctor/queue/consult-1/accept');
    expect(await screen.findByText('Confirmada')).toBeInTheDocument();
  });

  it('keeps a pending request pending when acceptance is rejected', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Conflict'));
    renderAgenda();
    await userEvent.click(await screen.findByTitle('Confirmar'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.queryByText('Confirmada')).not.toBeInTheDocument();
  });

  it('persists cancellation before changing the agenda', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { status: 'cancelled' } });
    renderAgenda();
    await userEvent.click(await screen.findByTitle('Cancelar'));
    expect(api.patch).toHaveBeenCalledWith('/api/v1/consultations/consult-1', {});
    await waitFor(() => expect(screen.getByText('Cancelada')).toBeInTheDocument());
  });
});
