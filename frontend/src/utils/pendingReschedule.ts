import type { Consultation } from '../types';
import { requestCanProceed } from './requestExpiry';

export function canReschedule(item: Consultation): boolean {
  return ['requested', 'scheduled'].includes(item.status) && !!item.doctor_id && ['AO', 'PT'].includes(item.country ?? '')
    && item.payment_status !== 'paid' && Number.isSafeInteger(item.reschedule_revision) && requestCanProceed(item);
}

export interface RescheduleAttempt { key: string; payload: { slot_id: string; expected_revision: number } }
const keyFor = (owner: string, consultation: string) => {
  if (!owner || !consultation) throw new Error('Authenticated account and consultation required');
  // Uses the existing logout cleanup prefix. No clinical text is persisted.
  return `kaya_pending_appointment:reschedule:${owner}:${consultation}`;
};
export function readReschedule(owner: string, consultation: string): RescheduleAttempt | null {
  const raw = sessionStorage.getItem(keyFor(owner, consultation));
  if (!raw) return null;
  const attempt = JSON.parse(raw) as RescheduleAttempt;
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(attempt.key) || !attempt.payload
      || typeof attempt.payload.slot_id !== 'string' || !attempt.payload.slot_id || attempt.payload.slot_id.length > 36
      || !Number.isSafeInteger(attempt.payload.expected_revision) || attempt.payload.expected_revision < 0
      || Object.keys(attempt.payload).some(key => !['slot_id', 'expected_revision'].includes(key))) throw new Error('Invalid rescheduling reference');
  return attempt;
}
export function saveReschedule(owner: string, consultation: string, attempt: RescheduleAttempt) {
  sessionStorage.setItem(keyFor(owner, consultation), JSON.stringify(attempt));
}
export function clearReschedule(owner: string, consultation: string, expectedKey: string) {
  if (readReschedule(owner, consultation)?.key === expectedKey) sessionStorage.removeItem(keyFor(owner, consultation));
}
export function rescheduleNotCommitted(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { detail?: { code?: unknown; request_key_committed?: unknown } } } })?.response;
  return response?.status === 409 && response.data?.detail?.code === 'reschedule_not_committed' && response.data.detail.request_key_committed === false;
}
