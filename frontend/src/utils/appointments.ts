import { getTargetMarket } from '../phase1/policy';

export interface AppointmentSlot {
  id: string; doctor_id: string; doctor_name: string; specialty: string;
  country: string; timezone: string; starts_at: string; ends_at: string;
  status: 'open' | 'reserved' | 'withdrawn';
}
export interface AppointmentCapabilities {
  enabled: boolean;
  markets: { country: string; timezones: string[] }[];
  max_window_days: number;
  max_publish_days?: number;
  slot_duration_minutes: { min: number; max: number };
}
export const APPOINTMENT_MARKETS = ['AO', 'PT'] as const;
export function marketZones(country: string): readonly string[] { return getTargetMarket(country)?.timezones ?? []; }
export function marketName(country: string): string { return getTargetMarket(country)?.country_name ?? country; }

/** Return every valid UTC instant for a clinic wall time. Gaps yield none; folds yield two. */
export function clinicTimeCandidates(local: string, timezone: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return [];
  const wall = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== local) return [];
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, calendar: 'iso8601', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const at = (timestamp: number) => {
      const fields = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(p => [p.type, p.value]));
      return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
    };
    const offsets = new Set([-36, -24, -12, 0, 12, 24, 36].map(hours => {
      const probe = wall + hours * 3600000;
      return Date.parse(`${at(probe)}:00Z`) - probe;
    }));
    return [...offsets].map(offset => wall - offset).filter(candidate => at(candidate) === local)
      .sort((a, b) => a - b).map(candidate => new Date(candidate).toISOString());
  } catch { return []; }
}

export function formatAppointmentTime(instant: string, timezone = 'UTC', locale = 'pt-PT'): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return 'Hora indisponível';
  try {
    return `${new Intl.DateTimeFormat(locale, { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }).format(date)} · ${timezone}`;
  } catch { return `${date.toISOString()} · UTC`; }
}
export function appointmentError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}
export function isAppointmentConflict(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 409;
}

/** An offset-bearing local timestamp preserves the clinician's explicit zone choice. */
export function clinicOffsetTimestamp(instant: string, timezone: string): string {
  const date = new Date(instant);
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, calendar: 'iso8601', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
  const wall = `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}`;
  const minutes = Math.round((Date.parse(`${wall}Z`) - date.getTime()) / 60000);
  const offset = `${minutes >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;
  return `${wall}${offset}`;
}

export function appointmentWindow(index: number, anchor: number, days = 31): { from_at: string; to_at: string } {
  const from = anchor + index * days * 86400000;
  return { from_at: new Date(from).toISOString(), to_at: new Date(from + days * 86400000).toISOString() };
}
export function appointmentWindowLabel(window: { from_at: string; to_at: string }): string {
  const format = new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'medium' });
  return `${format.format(new Date(window.from_at))} — ${format.format(new Date(window.to_at))} (UTC)`;
}
