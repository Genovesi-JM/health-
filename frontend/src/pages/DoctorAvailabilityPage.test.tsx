import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '../api';
import DoctorAvailabilityPage from './DoctorAvailabilityPage';
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
const capabilities = { enabled: true, markets: [], max_window_days: 31, slot_duration_minutes: { min: 15, max: 120 } };
const slot = { id: 'slot-1', starts_at: '2026-12-01T08:00:00Z', ends_at: '2026-12-01T08:30:00Z', country: 'AO', timezone: 'Africa/Luanda', status: 'open' };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('capabilities') ? capabilities : [slot] }));
  vi.mocked(api.post).mockResolvedValue({ data: slot });
  vi.mocked(api.delete).mockResolvedValue({ data: {} });
});
async function show() { render(<DoctorAvailabilityPage />); await screen.findByRole('button', { name: /^Retirar/ }); }
function localTime(value: string) { fireEvent.change(screen.getByLabelText('Data e hora local'), { target: { value } }); }
describe('explicit clinician availability', () => {
  it('keeps the form usable when duration exceeds the supported interval', async () => {
    await show(); localTime('2026-12-01T09:00');
    fireEvent.change(screen.getByLabelText('Duração em minutos'), { target: { value: '1000000000000' } });
    expect(screen.getByRole('button', { name: 'Publicar horário' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('lets clinicians inspect later date windows without publishing anything', async () => {
    await show();
    const first = vi.mocked(api.get).mock.calls.find(call => call[0].endsWith('appointment-slots'))![1]!.params;
    await userEvent.click(screen.getByRole('button', { name: 'Período seguinte' }));
    await waitFor(() => {
      const latest = vi.mocked(api.get).mock.calls.filter(call => call[0].endsWith('appointment-slots')).at(-1)![1]!.params;
      expect(latest.from_at).toBe(first.to_at);
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('publishes the selected Angola local time with correct UTC offset', async () => {
    await show(); localTime('2026-12-01T09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar horário' }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/doctor/appointment-slots', { country: 'AO', timezone: 'Africa/Luanda', starts_at: '2026-12-01T09:00:00+01:00', ends_at: '2026-12-01T09:30:00+01:00' });
    expect(await screen.findByText(/Horário publicado. Um pedido reserva/)).toBeInTheDocument();
  });
  it('requires an explicit occurrence for the repeated Portugal autumn hour', async () => {
    await show(); await userEvent.selectOptions(screen.getByLabelText('País do atendimento'), 'PT');
    localTime('2026-10-25T01:30');
    expect(screen.getByRole('button', { name: 'Publicar horário' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText(/Escolha a ocorrência/), '2026-10-25T01:30:00.000Z');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar horário' }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/doctor/appointment-slots', expect.objectContaining({ timezone: 'Europe/Lisbon', starts_at: '2026-10-25T01:30:00+00:00', ends_at: '2026-10-25T02:00:00+00:00' }));
  });
  it('rejects the nonexistent Portugal spring hour before sending', async () => {
    await show(); await userEvent.selectOptions(screen.getByLabelText('País do atendimento'), 'PT'); localTime('2026-03-29T01:30');
    expect(screen.getByRole('alert')).toHaveTextContent('Esta hora não existe');
    expect(screen.getByRole('button', { name: 'Publicar horário' })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
  });
  it('keeps publication input when a conflict refreshes the list', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409 } });
    await show(); localTime('2026-12-01T09:00'); await userEvent.click(screen.getByRole('button', { name: 'Publicar horário' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sobrepõe');
    expect(screen.getByLabelText('Data e hora local')).toHaveValue('2026-12-01T09:00');
    expect(api.get).toHaveBeenCalledTimes(4);
  });
  it('preserves a published row when withdrawal fails and surfaces the failure', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('Network'));
    await show(); await userEvent.click(screen.getByRole('button', { name: /^Retirar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível retirar');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Retirar/ })).toBeEnabled());
  });
  it('never offers withdrawal for a reserved slot', async () => {
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('capabilities') ? capabilities : [{ ...slot, status: 'reserved' }] }));
    render(<DoctorAvailabilityPage />);
    expect(await screen.findByText(/Reservado por pedido ou consulta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Retirar/ })).not.toBeInTheDocument();
  });
  it('distinguishes an unavailable list from no published slots', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Offline')); render(<DoctorAvailabilityPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível');
    expect(screen.queryByText(/Ainda não publicou horários/)).not.toBeInTheDocument();
  });
});
