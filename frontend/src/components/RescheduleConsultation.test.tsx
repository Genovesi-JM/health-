import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import type { Consultation } from '../types';
import RescheduleConsultation from './RescheduleConsultation';
import { readReschedule } from '../utils/pendingReschedule';

const identity = vi.hoisted(() => ({ userId: 'patient-user' }));
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() }, getSession: () => identity }));
const visit: Consultation = { id: 'consultation-1', patient_id: 'patient-1', doctor_id: 'doctor-1', status: 'scheduled',
  specialty: 'clinica_geral', country: 'AO', timezone: 'Africa/Luanda', slot_id: 'old-slot', scheduled_at: '2026-12-01T10:00:00Z',
  reschedule_revision: 0, payment_status: 'pending', created_at: '2026-10-04T10:00:00Z' };
const slot = { id: 'new-slot', doctor_id: 'doctor-1', doctor_name: 'Médico da consulta', specialty: 'clinica_geral', country: 'AO',
  timezone: 'Africa/Luanda', starts_at: '2026-12-02T10:00:00Z', ends_at: '2026-12-02T10:30:00Z', status: 'open' };
const saved = { ...visit, status: 'requested', slot_id: slot.id, scheduled_at: slot.starts_at, reschedule_revision: 1,
  request_expiry_state: 'open', requested_expires_at: '2099-01-01T00:00:00Z' };
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); identity.userId = 'patient-user';
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.includes('/appointments/slots') ? [slot] : [visit] }));
});
async function show(onUpdated = vi.fn()) {
  const view = render(<RescheduleConsultation consultation={visit} onClose={vi.fn()} onUpdated={onUpdated} />);
  await screen.findByRole('radio'); return { ...view, onUpdated };
}
function choose() { fireEvent.click(screen.getByRole('radio')); fireEvent.click(screen.getByRole('checkbox')); }
function submit() { fireEvent.click(screen.getByRole('button', { name: 'Confirmar novo horário' })); }

describe('reservation moves', () => {
  it('requires confirmation and waits for acknowledgment without cancelling the original', async () => {
    let finish: (value: unknown) => void = () => {};
    vi.mocked(api.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = await show();
    fireEvent.click(screen.getByRole('radio'));
    expect(screen.getByRole('button', { name: 'Confirmar novo horário' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); submit();
    fireEvent.click(screen.getByRole('button', { name: 'A guardar…' }));
    expect(api.post).toHaveBeenCalledOnce(); expect(view.onUpdated).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/api/v1/consultations/consultation-1/reschedule', { slot_id: 'new-slot', expected_revision: 0 },
      { headers: { 'Idempotency-Key': expect.any(String) } });
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await act(async () => { finish({ data: saved }); });
    expect(view.onUpdated).toHaveBeenCalledWith(saved);
    expect(screen.getByRole('status')).toHaveTextContent('aguarda aceitação');
    expect(readReschedule(identity.userId, visit.id)).toBeNull();
  });
  it('preserves the exact uncertain request across auth failure and reopening', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Lost reply')).mockRejectedValueOnce({ response: { status: 401 } }).mockResolvedValueOnce({ data: saved });
    const first = await show(); choose(); submit(); await screen.findByRole('alert');
    const original = vi.mocked(api.post).mock.calls[0];
    expect(screen.getByRole('radio')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar alteração' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(readReschedule(identity.userId, visit.id)?.key).toBe(original[2]?.headers?.['Idempotency-Key']);
    first.unmount(); const reopened = await show();
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar alteração' }));
    await waitFor(() => expect(reopened.onUpdated).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[1]).toEqual(original); expect(vi.mocked(api.post).mock.calls[2]).toEqual(original);
  });
  it('does not treat a generic later409 as proof that the uncertain request failed', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Lost reply')).mockRejectedValueOnce({ response: { status: 409 } });
    await show(); choose(); submit(); await screen.findByRole('alert');
    const key = readReschedule(identity.userId, visit.id)?.key;
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar alteração' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(readReschedule(identity.userId, visit.id)?.key).toBe(key);
    expect(screen.getByRole('radio')).toBeDisabled();
  });
  it('requires current state, a new selection and reconfirmation after a proven rejection', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 409, data: { detail: { code: 'reschedule_not_committed', request_key_committed: false, message: 'Outra sessão alterou o horário.' } } } }).mockResolvedValueOnce({ data: { ...saved, reschedule_revision: 4 } });
    const view = await show(); choose(); submit(); await screen.findByRole('alert');
    const originalKey = vi.mocked(api.post).mock.calls[0][2]?.headers?.['Idempotency-Key'];
    expect(readReschedule(identity.userId, visit.id)).toBeNull();
    expect(screen.getByRole('radio')).toBeDisabled();
    vi.mocked(api.get).mockImplementation(async url => ({ data: url.includes('/appointments/slots') ? [slot] : [{ ...visit, reschedule_revision: 3 }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar marcação atual' }));
    await waitFor(() => expect(screen.getByRole('radio')).toBeEnabled());
    expect(api.get).toHaveBeenCalledWith('/api/v1/consultations/me', { params: { consultation_id: visit.id } });
    expect(screen.getByRole('checkbox')).not.toBeChecked(); choose(); submit();
    await waitFor(() => expect(view.onUpdated).toHaveBeenLastCalledWith({ ...saved, reschedule_revision: 4 }));
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual({ slot_id: 'new-slot', expected_revision: 3 });
    expect(vi.mocked(api.post).mock.calls[1][2]?.headers?.['Idempotency-Key']).not.toBe(originalKey);
  });
  it('does not update a new account with a delayed move response', async () => {
    let finish: (value: unknown) => void = () => {};
    vi.mocked(api.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = await show(); choose(); submit(); identity.userId = 'new-account';
    await act(async () => { finish({ data: saved }); });
    expect(view.onUpdated).not.toHaveBeenCalled();
    expect(readReschedule('new-account', visit.id)).toBeNull();
  });
  it('fails before sending when the recovery reference cannot be saved', async () => {
    await show(); choose();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    submit(); expect(screen.getByRole('alert')).toHaveTextContent('Nenhum pedido foi enviado');
    expect(api.post).not.toHaveBeenCalled(); write.mockRestore();
  });
});
