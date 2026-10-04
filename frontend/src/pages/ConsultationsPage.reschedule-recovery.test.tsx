import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../api';
import { I18nProvider } from '../i18n/LanguageContext';
import { readReschedule, saveReschedule } from '../utils/pendingReschedule';
import ConsultationsPage from './ConsultationsPage';

const identity = vi.hoisted(() => ({ userId: 'patient-user' }));
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, getSession: () => identity }));
vi.mock('../components/BookConsultationModal', () => ({ default: () => null }));
vi.mock('../components/PaymentModal', () => ({ default: () => null }));
vi.mock('../components/ChatModal', () => ({ default: () => null }));
vi.mock('../components/ReviewModal', () => ({ default: () => null }));
vi.mock('../components/TeleconsultationControl', () => ({ default: () => null }));
vi.mock('../components/ConsultationCloseout', () => ({ default: () => null }));
const visit = { id: 'visit-1', specialty: 'clinica_geral', patient_id: 'patient-1', doctor_id: 'doctor-1', status: 'scheduled',
  scheduled_at: '2026-12-01T08:00:00Z', timezone: 'Africa/Luanda', country: 'AO', reschedule_revision: 1,
  created_at: '2026-10-01T08:00:00Z', payment_status: 'unpaid' };
const attempt = { key: '12345678-1234-1234-1234-123456789012', payload: { slot_id: 'new-slot', expected_revision: 0 } };
function show() { return render(<MemoryRouter><I18nProvider><ConsultationsPage /></I18nProvider></MemoryRouter>); }
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); identity.userId = 'patient-user';
});

it.each([{ status: 'in_progress' }, { status: 'completed' }, { payment_status: 'paid' }])(
  'recovers the exact saved request after fresh rescheduling is no longer eligible: %j', async change => {
    const current = { ...visit, ...change };
    saveReschedule(identity.userId, visit.id, attempt);
    vi.mocked(api.get).mockImplementation(async url => {
      if (url.includes('/appointments/slots')) throw new Error('Offline slot catalogue');
      return { data: url.endsWith('/me/page') ? { items: [current], next_cursor: null } : null };
    });
    vi.mocked(api.post).mockResolvedValue({ data: current });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Recuperar alteração' }));
    const dialog = screen.getByRole('dialog', { name: 'Alterar horário da consulta' });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Recuperar alteração' }));
    await within(dialog).findByText('Pedido recuperado. O estado atual da consulta foi atualizado na lista.');
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/api/v1/consultations/visit-1/reschedule', attempt.payload,
      { headers: { 'Idempotency-Key': attempt.key } });
    expect(api.patch).not.toHaveBeenCalled();
    expect(readReschedule(identity.userId, visit.id)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('button', { name: 'Recuperar alteração' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alterar horário' })).not.toBeInTheDocument();
  },
);

it('keeps cancellation unavailable until the pending change is confirmed, without exposing another owner’s attempt', async () => {
  saveReschedule('other-account', visit.id, attempt);
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/me/page') ? { items: [visit], next_cursor: null } : [] }));
  const first = show();
  expect(await screen.findByRole('button', { name: 'Cancelar consulta' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Recuperar alteração' })).not.toBeInTheDocument();
  first.unmount();
  saveReschedule(identity.userId, visit.id, attempt);
  show();
  expect(await screen.findByRole('button', { name: 'Cancelar consulta' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Recuperar alteração' })).toBeEnabled();
});

it('keeps a storage failure visible through the recovery dialog and sends no new mutation', async () => {
  sessionStorage.setItem(`kaya_pending_appointment:reschedule:${identity.userId}:${visit.id}`, '{broken');
  vi.mocked(api.get).mockImplementation(async url => ({ data: url.endsWith('/me/page') ? { items: [visit], next_cursor: null } : [] }));
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Recuperar alteração' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível ler a referência'));
  expect(screen.getByRole('button', { name: 'Confirmar novo horário' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});
