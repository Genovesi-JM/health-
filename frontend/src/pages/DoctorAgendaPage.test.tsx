import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/LanguageContext';
import api from '../api';
import DoctorAgendaPage from './DoctorAgendaPage';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: [{
    id: 'consult-1', time: '10:00', patient: 'Paciente de teste',
    type: 'teleconsulta', reason: 'Pedido de teste', status: 'pending', reschedule_revision: 2,
  }] });
});

function renderAgenda() {
  return render(<MemoryRouter><I18nProvider><DoctorAgendaPage /></I18nProvider></MemoryRouter>);
}

describe('doctor agenda persistence', () => {
  it('loads the selected future date in the explicit clinic timezone', async () => {
    renderAgenda(); await screen.findByTitle('Confirmar');
    fireEvent.change(screen.getByLabelText('Data da agenda'), { target: { value: '2026-12-01' } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/doctor/agenda/today', { params: { date: '2026-12-01', country: 'AO', timezone: 'Africa/Luanda' } }));
    expect(await screen.findByText('Paciente de teste')).toBeInTheDocument();
  });
  it('reloads Portugal with the selected clinic timezone', async () => {
    renderAgenda(); await screen.findByTitle('Confirmar');
    await userEvent.selectOptions(screen.getByLabelText('País do atendimento'), 'PT');
    await userEvent.selectOptions(screen.getByLabelText('Fuso horário da agenda'), 'Atlantic/Azores');
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/doctor/agenda/today', { params: { date: expect.any(String), country: 'PT', timezone: 'Atlantic/Azores' } }));
  });
  it('does not show a false empty agenda on failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Offline'));
    renderAgenda(); expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    expect(screen.queryByText('Sem consultas neste dia')).not.toBeInTheDocument();
  });

  it('uses explicit backend acceptance and its returned state', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'scheduled' } });
    renderAgenda();
    await userEvent.click(await screen.findByTitle('Confirmar'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/doctor/queue/consult-1/accept', undefined, { params: { expected_revision: 2 } });
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
