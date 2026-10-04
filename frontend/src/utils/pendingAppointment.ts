const PREFIX = 'kaya_pending_appointment:';
export interface PendingAppointment {
  key: string;
  payload: { country: string; specialty: string; slot_id?: string; next_available?: true; triage_session_id?: string };
}
const storageKey = (owner: string) => {
  if (!owner) throw new Error('Authenticated account required');
  return `${PREFIX}${owner}`;
};
export function readPendingAppointment(owner: string): PendingAppointment | null {
  const value = sessionStorage.getItem(storageKey(owner));
  if (!value) return null;
  const parsed = JSON.parse(value) as PendingAppointment;
  const payload = parsed.payload;
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(parsed.key) || !payload || !['AO', 'PT'].includes(payload.country) || typeof payload.specialty !== 'string' ||
      Object.keys(payload).some(key => !['country', 'specialty', 'slot_id', 'next_available', 'triage_session_id'].includes(key)) ||
      !(typeof payload.slot_id === 'string' && !payload.next_available || payload.next_available === true && !payload.slot_id) ||
      (payload.triage_session_id !== undefined && typeof payload.triage_session_id !== 'string')) throw new Error('Invalid pending appointment');
  return parsed;
}
export function savePendingAppointment(owner: string, pending: PendingAppointment): void {
  sessionStorage.setItem(storageKey(owner), JSON.stringify(pending));
}
export function clearPendingAppointment(owner: string): void { sessionStorage.removeItem(storageKey(owner)); }
export function clearPendingAppointments(): void {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
  } catch { /* A browser that denies storage cannot contain a usable recovery record. */ }
}
