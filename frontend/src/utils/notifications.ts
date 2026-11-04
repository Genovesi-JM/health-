export interface InboxNotification {
  id: string; title: string; message: string; type: string; is_read: boolean;
  created_at: string; read_at: string | null; channel: 'in_app';
  related_entity_type?: string | null; related_entity_id?: string | null;
}
export interface NotificationInbox {
  items: InboxNotification[]; next_cursor: string | null; unread_count: number;
}
export interface NotificationCapabilities {
  channels: { in_app: boolean; email: boolean; sms: boolean; push: boolean };
  read_is_care_acknowledgement: false;
}
export const NOTIFICATIONS_CHANGED = 'kaya:notifications-changed';
export function validUnreadCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function notifyInboxChanged(ownerId: string, unread?: number): void {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED, { detail: { ownerId, unread } }));
}
/** Fixed app destinations only. An inbox relationship never grants resource access. */
export function notificationDestination(item: InboxNotification, role?: string): { to: string; label: string } | null {
  if (!item.related_entity_id) return null;
  if (item.related_entity_type === 'consultation') {
    if (role === 'patient' || role === 'cliente') return { to: '/consultations', label: 'Abrir consultas' };
    if (role === 'doctor') return { to: '/doctor/agenda', label: 'Abrir agenda' };
  }
  if (item.related_entity_type === 'clinical_care_task') {
    if (role === 'doctor') return { to: '/doctor/pacientes', label: 'Abrir lista de pacientes' };
    if (role === 'nurse') return { to: '/nurse', label: 'Abrir espaço de enfermagem' };
  }
  return null;
}
export function notificationTime(value: string, locale = 'pt-PT'): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Data indisponível';
}
export function notificationError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}
