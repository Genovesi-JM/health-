import type { PatientConsultation } from './consultations';

export type AppointmentCountry = 'AO' | 'PT';
export type AppointmentSlot = {
  id: string;
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  country: AppointmentCountry;
  timezone: string;
  starts_at: string;
  ends_at: string;
  status: 'open' | 'reserved' | 'withdrawn';
};
export type AppointmentCapabilities = {
  enabled: boolean;
  markets: { country: string; timezones: string[] }[];
  max_window_days: number;
  max_publish_days?: number;
};
export type BookingPayload = {
  consent_language?: 'pt';
  country: AppointmentCountry;
  specialty: string;
  slot_id?: string;
  next_available?: true;
};
export type BookingAttempt = { key: string; payload: BookingPayload };

export const APPOINTMENT_MARKETS = { AO: 'Angola', PT: 'Portugal' };
export const APPOINTMENT_SPECIALTIES = [
  { code: 'clinica_geral', label: 'Clínica Geral' },
  { code: 'cardiologia', label: 'Cardiologia' },
  { code: 'dermatologia', label: 'Dermatologia' },
  { code: 'pediatria', label: 'Pediatria' },
  { code: 'ginecologia', label: 'Ginecologia' },
  { code: 'psiquiatria', label: 'Psiquiatria' },
  { code: 'ortopedia', label: 'Ortopedia' },
  { code: 'oftalmologia', label: 'Oftalmologia' },
  { code: 'neurologia', label: 'Neurologia' },
  { code: 'medicina_interna', label: 'Medicina Interna' },
];

export type AppointmentWindow = { page: number; lastPage: number; from_at: string; to_at: string; label: string };

export function appointmentWindow(page: number, anchor = Date.now(), windowDays = 31, publishDays = 180): AppointmentWindow {
  const day = 86_400_000;
  const length = Number.isInteger(windowDays) && windowDays > 0 ? Math.min(windowDays, 31) : 31;
  const horizon = Number.isInteger(publishDays) && publishDays > 0 ? Math.min(publishDays, 180) : 180;
  const lastPage = Math.floor(horizon / length);
  const currentPage = Math.max(0, Math.min(Number.isFinite(page) ? Math.floor(page) : 0, lastPage));
  const today = Math.floor(anchor / day) * day;
  const start = today + currentPage * length * day;
  // Include the final publishable calendar day. The server applies its exact
  // rolling horizon when publishing and filters elapsed slots when listing.
  const end = Math.min(start + length * day, today + (horizon + 1) * day);
  const labelDate = (value: number) => new Date(value).toLocaleDateString('pt-PT', { timeZone: 'UTC' });
  return { page: currentPage, lastPage, from_at: new Date(start).toISOString(), to_at: new Date(end).toISOString(), label: `${labelDate(start)} a ${labelDate(end - 1)} (UTC)` };
}

export function appointmentSlotsPath(country: AppointmentCountry, specialty: string, window?: Pick<AppointmentWindow, 'from_at' | 'to_at'>): string {
  return `/api/v1/appointments/slots?country=${encodeURIComponent(country)}&specialty=${encodeURIComponent(specialty)}` +
    (window ? `&from_at=${encodeURIComponent(window.from_at)}&to_at=${encodeURIComponent(window.to_at)}` : '');
}

/** A request identifier only; never an authentication or authorization token. */
function newBookingKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, symbol => {
    const value = Math.floor(Math.random() * 16);
    return (symbol === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export function availableSlots(slots: AppointmentSlot[], country: AppointmentCountry, specialty: string, now = Date.now()): AppointmentSlot[] {
  return slots.filter(slot => slot.status === 'open' && slot.country === country && slot.specialty === specialty &&
    Number.isFinite(Date.parse(slot.starts_at)) && Date.parse(slot.starts_at) > now &&
    Number.isFinite(Date.parse(slot.ends_at)) && Date.parse(slot.ends_at) > Date.parse(slot.starts_at))
    .sort((left, right) => Date.parse(left.starts_at) - Date.parse(right.starts_at));
}

export function createBookingAttempt(country: AppointmentCountry, specialty: string, slot?: AppointmentSlot, key = newBookingKey(), now = Date.now()): BookingAttempt {
  if (!APPOINTMENT_MARKETS[country] || !APPOINTMENT_SPECIALTIES.some(item => item.code === specialty)) {
    throw new Error('Selecione o país e a especialidade da consulta.');
  }
  if (slot && availableSlots([slot], country, specialty, now).length !== 1) {
    throw new Error('Este horário já não está disponível. Atualize os horários.');
  }
  return { key, payload: { country, consent_language: 'pt', specialty, ...(slot ? { slot_id: slot.id } : { next_available: true }) } };
}

/** Kept in SecureStore per patient before sending, so a lost response or app
 * restart can retry the same request instead of creating a second booking. */
export function bookingStorageKey(patientUserId: string): string {
  return `kaya_booking_${Array.from(patientUserId).map(character => character.codePointAt(0)!.toString(16)).join('_')}`;
}

export function restoreBookingAttempt(value: string | null): BookingAttempt | null {
  if (value === null) return null;
  try {
    const attempt = JSON.parse(value) as BookingAttempt;
    const payload = attempt.payload;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attempt.key) ||
        !payload || (payload.consent_language !== undefined && payload.consent_language !== 'pt') || !Object.hasOwn(APPOINTMENT_MARKETS, payload.country) ||
        !APPOINTMENT_SPECIALTIES.some(item => item.code === payload.specialty) ||
        (typeof payload.slot_id === 'string' && payload.slot_id.length > 0 ? payload.next_available !== undefined : payload.next_available !== true || payload.slot_id !== undefined)) {
      throw new Error('Invalid attempt');
    }
    return { key: attempt.key, payload: { country: payload.country, specialty: payload.specialty,
      ...(payload.consent_language === undefined ? {} : { consent_language: payload.consent_language }),
      ...(payload.slot_id ? { slot_id: payload.slot_id } : { next_available: true }) } };
  } catch {
    throw new Error('Não foi possível recuperar o pedido anterior. Verifique As minhas consultas antes de fazer outro pedido.');
  }
}

export async function sendBookingAttempt(
  api: { post: (path: string, data: BookingPayload, options: { headers: Record<string, string> }) => Promise<{ data: PatientConsultation }> },
  attempt: BookingAttempt,
): Promise<PatientConsultation> {
  const response = await api.post('/api/v1/consultations/book', attempt.payload, { headers: { 'Idempotency-Key': attempt.key } });
  return response.data;
}

export async function sendRecoverableBooking(
  api: Parameters<typeof sendBookingAttempt>[0],
  storage: { setItemAsync: (key: string, value: string) => Promise<void>; deleteItemAsync: (key: string) => Promise<void> },
  patientUserId: string,
  attempt: BookingAttempt,
  previouslySent = false,
): Promise<PatientConsultation> {
  const key = bookingStorageKey(patientUserId);
  // No POST is issued until the exact retry body and key are saved locally.
  await storage.setItemAsync(key, JSON.stringify(attempt));
  let result: PatientConsultation;
  try {
    result = await sendBookingAttempt(api, attempt);
  } catch (failure) {
    if (definitiveBookingFailure(failure, previouslySent)) await storage.deleteItemAsync(key);
    throw failure;
  }
  // If clearing fails, preserve the same attempt in the UI. Its retry retrieves
  // the already committed consultation through server idempotency.
  await storage.deleteItemAsync(key);
  return result;
}

export function definitiveBookingFailure(error: unknown, previouslySent = false): boolean {
  // Authentication/consent gates run before idempotency lookup. A 401/403 can
  // follow a prior committed request, so keep its key for reauthentication.
  const status = (error as { response?: { status?: number } })?.response?.status;
  // A conflict comes after idempotency lookup. Other validation failures may
  // precede it; do not discard an earlier uncertain request on those failures.
  return status === 409 || (!previouslySent && [400, 404, 422].includes(status ?? 0));
}

export function bookingConflict(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 409;
}

export function appointmentDate(value: string | null | undefined, timezone?: string | null): string {
  if (!value) return 'Por definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Por definir';
  try {
    const zone = timezone || 'UTC';
    const offsetName = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(date).find(part => part.type === 'timeZoneName')?.value;
    if (!offsetName) throw new Error('Timezone offset unavailable');
    const offset = offsetName === 'GMT' ? 'UTC+00:00' : offsetName.replace('GMT', 'UTC');
    return `${date.toLocaleString('pt-PT', { timeZone: zone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} (${zone}; ${offset})`;
  } catch {
    // An older native runtime may lack a timezone. Never silently substitute
    // the device timezone for a clinical appointment's published time.
    return `${date.toISOString().slice(0, 16).replace('T', ' ')} (UTC; UTC+00:00)`;
  }
}

export function appointmentRange(slot: Pick<AppointmentSlot, 'starts_at' | 'ends_at' | 'timezone'>): string {
  return `${appointmentDate(slot.starts_at, slot.timezone)} — ${appointmentDate(slot.ends_at, slot.timezone)}`;
}
