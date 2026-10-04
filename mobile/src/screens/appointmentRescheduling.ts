import type { PatientConsultation } from './consultations';
import type { AppointmentSlot, AppointmentWindow } from './appointmentAvailability';

export type RescheduleAttempt = {
  key: string;
  consultationId: string;
  payload: { slot_id: string; expected_revision: number };
  selected: { starts_at: string; ends_at: string; timezone: string; doctor_name: string; country: 'AO' | 'PT' };
};
type RescheduleStorage = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void>; deleteItemAsync(key: string): Promise<void> };
const storageWrites = new Map<string, Promise<unknown>>();
function serializeStorage<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const next = (storageWrites.get(key) || Promise.resolve()).catch(() => undefined).then(operation);
  storageWrites.set(key, next);
  void next.finally(() => { if (storageWrites.get(key) === next) storageWrites.delete(key); }).catch(() => undefined);
  return next;
}

async function clearMatchingAttempt(storage: RescheduleStorage, key: string, attempt: RescheduleAttempt): Promise<void> {
  await serializeStorage(key, async () => {
    const current = restoreRescheduleAttempt(await storage.getItemAsync(key), attempt.consultationId);
    if (current?.key === attempt.key) await storage.deleteItemAsync(key);
  });
}

export function rescheduleStorageKey(ownerId: string, consultationId: string): string {
  const encode = (value: string) => Array.from(value).map(character => character.codePointAt(0)!.toString(16)).join('_');
  return `kaya_reschedule_${encode(ownerId)}__${encode(consultationId)}`;
}

export function canRescheduleConsultation(consultation: PatientConsultation | null): boolean {
  return !!consultation && ['requested', 'scheduled'].includes(consultation.status) &&
    !!consultation.doctor_id && ['AO', 'PT'].includes(consultation.country || '') &&
    consultation.payment_status !== 'paid' && consultation.payment_id == null &&
    Number.isSafeInteger(consultation.reschedule_revision) && consultation.reschedule_revision! >= 0;
}

export function rescheduleSlotsPath(consultation: PatientConsultation, window: AppointmentWindow): string {
  if (!consultation.doctor_id || !['AO', 'PT'].includes(consultation.country || '')) throw new Error('Não foi possível confirmar o médico e o país da consulta.');
  return `/api/v1/appointments/slots?country=${encodeURIComponent(consultation.country!)}&doctor_id=${encodeURIComponent(consultation.doctor_id)}` +
    `&from_at=${encodeURIComponent(window.from_at)}&to_at=${encodeURIComponent(window.to_at)}`;
}

export function rescheduleSlots(slots: AppointmentSlot[], consultation: PatientConsultation, now = Date.now()): AppointmentSlot[] {
  return slots.filter(slot => slot.status === 'open' && slot.doctor_id === consultation.doctor_id && slot.country === consultation.country &&
    slot.id !== consultation.slot_id && Number.isFinite(Date.parse(slot.starts_at)) && Date.parse(slot.starts_at) > now &&
    Number.isFinite(Date.parse(slot.ends_at)) && Date.parse(slot.ends_at) > Date.parse(slot.starts_at))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

export function createRescheduleAttempt(consultation: PatientConsultation, slot: AppointmentSlot, key: string, now = Date.now()): RescheduleAttempt {
  if (!canRescheduleConsultation(consultation) || rescheduleSlots([slot], consultation, now).length !== 1) {
    throw new Error('A consulta ou o horário mudou. Atualize os dados antes de escolher novamente.');
  }
  return { key, consultationId: consultation.id, payload: { slot_id: slot.id, expected_revision: consultation.reschedule_revision! },
    selected: { starts_at: slot.starts_at, ends_at: slot.ends_at, timezone: slot.timezone, doctor_name: slot.doctor_name, country: slot.country } };
}

export function restoreRescheduleAttempt(value: string | null, consultationId: string): RescheduleAttempt | null {
  if (value === null) return null;
  try {
    if (value.length > 4096) throw new Error('Invalid attempt');
    const attempt = JSON.parse(value) as RescheduleAttempt;
    if (!attempt || attempt.consultationId !== consultationId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attempt.key) ||
        typeof attempt.payload?.slot_id !== 'string' || !attempt.payload.slot_id ||
        !Number.isSafeInteger(attempt.payload.expected_revision) || attempt.payload.expected_revision < 0 ||
        Object.keys(attempt.payload).sort().join(',') !== 'expected_revision,slot_id' ||
        !attempt.selected || !['AO', 'PT'].includes(attempt.selected.country) ||
        typeof attempt.selected.doctor_name !== 'string' || !attempt.selected.doctor_name ||
        typeof attempt.selected.timezone !== 'string' || !attempt.selected.timezone ||
        typeof attempt.selected.starts_at !== 'string' || typeof attempt.selected.ends_at !== 'string' ||
        !/(?:Z|[+-]\d{2}:\d{2})$/.test(attempt.selected.starts_at) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(attempt.selected.ends_at) ||
        !Number.isFinite(Date.parse(attempt.selected.starts_at)) || !Number.isFinite(Date.parse(attempt.selected.ends_at)) ||
        Date.parse(attempt.selected.ends_at) <= Date.parse(attempt.selected.starts_at)) throw new Error('Invalid attempt');
    return { key: attempt.key, consultationId, payload: { ...attempt.payload }, selected: {
      doctor_name: attempt.selected.doctor_name, timezone: attempt.selected.timezone, country: attempt.selected.country,
      starts_at: attempt.selected.starts_at, ends_at: attempt.selected.ends_at,
    } };
  } catch { throw new Error('Não foi possível recuperar a alteração anterior. Não inicie outra alteração antes de verificar esse pedido.'); }
}

export function rescheduleNotCommitted(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { detail?: { code?: unknown; request_key_committed?: unknown } } } })?.response;
  return response?.status === 409 && response.data?.detail?.code === 'reschedule_not_committed' && response.data.detail.request_key_committed === false;
}

export function rescheduleError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') return detail.message;
  return fallback;
}

export async function loadRescheduleConsultation(api: { get(path: string): Promise<{ data: unknown }> }, id: string): Promise<PatientConsultation> {
  const response = await api.get(`/api/v1/consultations/me?consultation_id=${encodeURIComponent(id)}`);
  const items = response.data;
  if (!Array.isArray(items) || items.length !== 1 || items[0]?.id !== id) throw new Error('Não foi possível confirmar a consulta atual.');
  return items[0] as PatientConsultation;
}

/** Unknown transport/auth/validation/conflict outcomes retain the exact durable request.
 * Only a committed result or the server's explicit locked noncommit proof clears it. */
export async function sendRecoverableReschedule(
  api: { post(path: string, data: RescheduleAttempt['payload'], options: { headers: Record<string, string> }): Promise<{ data: PatientConsultation }> },
  storage: RescheduleStorage, ownerId: string, attempt: RescheduleAttempt,
): Promise<{ kind: 'success'; consultation: PatientConsultation } | { kind: 'not_committed'; message: string }> {
  const storageKey = rescheduleStorageKey(ownerId, attempt.consultationId);
  await serializeStorage(storageKey, async () => {
    const existing = restoreRescheduleAttempt(await storage.getItemAsync(storageKey), attempt.consultationId);
    if (existing && (existing.key !== attempt.key || JSON.stringify(existing.payload) !== JSON.stringify(attempt.payload))) {
      throw new Error('Existe outra alteração por confirmar. Recupere o pedido guardado antes de continuar.');
    }
    await storage.setItemAsync(storageKey, JSON.stringify(attempt));
  });
  let consultation: PatientConsultation;
  try {
    const response = await api.post(`/api/v1/consultations/${encodeURIComponent(attempt.consultationId)}/reschedule`, attempt.payload,
      { headers: { 'Idempotency-Key': attempt.key } });
    consultation = response.data;
    if (consultation.id !== attempt.consultationId || !Number.isSafeInteger(consultation.reschedule_revision) ||
        consultation.reschedule_revision! <= attempt.payload.expected_revision) throw new Error('Não foi possível verificar o resultado da alteração.');
  } catch (failure) {
    if (!rescheduleNotCommitted(failure)) throw failure;
    await clearMatchingAttempt(storage, storageKey, attempt);
    return { kind: 'not_committed', message: rescheduleError(failure, 'A alteração não foi guardada. Atualize a consulta e escolha novamente.') };
  }
  await clearMatchingAttempt(storage, storageKey, attempt);
  return { kind: 'success', consultation };
}
