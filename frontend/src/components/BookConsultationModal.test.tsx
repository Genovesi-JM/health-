import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/LanguageContext';
import api, { getSession } from '../api';
import BookConsultationModal from './BookConsultationModal';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() }, getSession: vi.fn() }));
const slot = { id: 'slot-1', doctor_id: 'doctor-1', doctor_name: 'Médica de teste', country: 'AO', timezone: 'Africa/Luanda', specialty: 'clinica_geral', starts_at: '2026-12-01T08:00:00Z', ends_at: '2026-12-01T08:30:00Z', status: 'open' };
const capabilities = { enabled: true, markets: [{ country: 'AO', timezones: ['Africa/Luanda'] }], max_window_days: 31, slot_duration_minutes: { min: 15, max: 120 } };
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  vi.mocked(getSession).mockReturnValue({ token: 'token', userId: 'patient-1', email: '', name: '', role: 'patient' });
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url.endsWith('capabilities') ? capabilities : [slot] }));
  vi.mocked(api.post).mockResolvedValue({ data: { id: 'consult-1', status: 'requested', scheduled_at: slot.starts_at, timezone: slot.timezone } });
});
function show(open = true, onBooked = vi.fn()) {
  return render(<MemoryRouter><I18nProvider><BookConsultationModal open={open} onClose={vi.fn()} patientState={null} onBooked={onBooked} /></I18nProvider></MemoryRouter>);
}
async function choose() {
  await userEvent.selectOptions(screen.getByLabelText('Especialidade'), 'clinica_geral');
  await userEvent.click(await screen.findByRole('radio'));
}
describe('published appointment booking', () => {
  it('recovers the same request after a page reload even when its slot is no longer listed', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Response lost'));
    const page = show(); await choose(); await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    await screen.findByRole('button', { name: 'Recuperar pedido' });
    const original = vi.mocked(api.post).mock.calls[0]; page.unmount();
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('capabilities') ? capabilities : [] }));
    show(); await userEvent.click(await screen.findByRole('button', { name: 'Recuperar pedido' }));
    expect(vi.mocked(api.post).mock.calls[1]).toEqual(original);
    expect(await screen.findByText(/Pedido enviado/)).toBeInTheDocument();
    expect(sessionStorage.getItem('kaya_pending_appointment:patient-1')).toBeNull();
  });
  it('keeps the original recovered request when a validation rejection precedes replay lookup', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Response lost')).mockRejectedValueOnce({ response: { status: 404, data: { detail: 'Related record unavailable' } } });
    const page = show(); await choose(); await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    await screen.findByRole('button', { name: 'Recuperar pedido' }); page.unmount();
    show(); await userEvent.click(await screen.findByRole('button', { name: 'Recuperar pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Related record unavailable');
    expect(sessionStorage.getItem('kaya_pending_appointment:patient-1')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Recuperar pedido' }));
    expect(vi.mocked(api.post).mock.calls[2]).toEqual(vi.mocked(api.post).mock.calls[0]);
    await screen.findByText(/Pedido enviado/);
  });
  it('does not recover another account’s pending request', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Response lost'));
    const page = show(); await choose(); await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    await screen.findByRole('button', { name: 'Recuperar pedido' }); page.unmount();
    vi.mocked(getSession).mockReturnValue({ token: 'another', userId: 'patient-2', email: '', name: '', role: 'patient' });
    show(); await waitFor(() => expect(screen.queryByText('A verificar disponibilidade…')).not.toBeInTheDocument()); expect(screen.queryByRole('button', { name: 'Recuperar pedido' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Especialidade')).toHaveValue('');
    expect(api.post).toHaveBeenCalledTimes(1);
  });
  it('does not send if the pending reference cannot be stored safely', async () => {
    show(); await choose();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    try {
      await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível guardar');
      expect(api.post).not.toHaveBeenCalled();
    } finally { write.mockRestore(); }
  });

  it('loads later published periods through explicit bounded date windows', async () => {
    show(); await choose();
    const first = vi.mocked(api.get).mock.calls.find(call => call[0].endsWith('/slots'))![1]!.params as { from_at: string; to_at: string };
    await userEvent.click(screen.getByRole('button', { name: 'Período seguinte' }));
    await waitFor(() => {
      const latest = vi.mocked(api.get).mock.calls.filter(call => call[0].endsWith('/slots')).at(-1)![1]!.params as { from_at: string; to_at: string };
      expect(latest.from_at).toBe(first.to_at);
      expect(Date.parse(latest.to_at) - Date.parse(latest.from_at)).toBe(31 * 86400000);
    });
    expect(screen.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled();
  });

  it('sends the selected server slot and an idempotency key, and accurately shows requested status', async () => {
    const onBooked = vi.fn(); show(true, onBooked); await choose();
    expect(screen.queryByDisplayValue('2026-12-01T08:00')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/consultations/book', { country: 'AO', consent_language: 'pt', specialty: 'clinica_geral', slot_id: 'slot-1' }, { headers: { 'Idempotency-Key': expect.any(String) } });
    expect(await screen.findByRole('status')).toHaveTextContent('aguarda aceitação');
    expect(onBooked).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ver as minhas consultas' }));
    expect(onBooked).toHaveBeenCalledWith(expect.objectContaining({ id: 'consult-1' }));
  });
  it('retries an uncertain submission with the same payload and key', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network timeout'));
    show(); await choose(); await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Recuperar pedido' }));
    expect(vi.mocked(api.post).mock.calls[1]).toEqual(vi.mocked(api.post).mock.calls[0]);
    expect(await screen.findByRole('status')).toHaveTextContent('aguarda aceitação');
  });
  it('refreshes a conflict and requires a new selection without dropping market or specialty', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 409 } });
    show(); await choose(); await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A disponibilidade mudou');
    await waitFor(() => expect(screen.getByRole('radio')).not.toBeChecked());
    expect(screen.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled();
    expect(screen.getByLabelText('Especialidade')).toHaveValue('clinica_geral');
    await userEvent.click(screen.getByRole('radio')); await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    const calls = vi.mocked(api.post).mock.calls;
    expect(calls[0][2]?.headers?.['Idempotency-Key']).not.toBe(calls[1][2]?.headers?.['Idempotency-Key']);
  });
  it('uses explicit Portugal and keeps the unscheduled queue separate from slots', async () => {
    show(); await userEvent.selectOptions(screen.getByLabelText('País do atendimento'), 'PT');
    await userEvent.selectOptions(screen.getByLabelText('Especialidade'), 'clinica_geral');
    await userEvent.click(screen.getByRole('button', { name: 'Pedido sem hora marcada' }));
    expect(screen.getByText(/sem hora reservada/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/consultations/book', { country: 'PT', consent_language: 'pt', specialty: 'clinica_geral', next_available: true }, expect.any(Object));
  });
  it('distinguishes slot load failure from a confirmed empty list', async () => {
    vi.mocked(api.get).mockImplementation(async url => { if (url.endsWith('capabilities')) return { data: capabilities }; throw new Error('Offline'); });
    show(); await userEvent.selectOptions(screen.getByLabelText('Especialidade'), 'clinica_geral');
    expect(await screen.findByRole('alert')).toHaveTextContent('A lista não foi confirmada');
    expect(screen.queryByText(/Sem horários publicados/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled();
  });
  it('blocks duplicate clicks while sending and does not allow closing during submission', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    show(); await choose(); await userEvent.dblClick(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(api.post).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    finish({ data: { id: 'consult-1', status: 'requested' } });
    await screen.findByText(/Pedido enviado/);
  });
});
