import { describe, expect, it } from 'vitest';
import { notificationDestination, notificationTime, validUnreadCount, type InboxNotification } from './notifications';
const item: InboxNotification = { id: 'n-1', title: 'Notice', message: 'Message', type: 'info', is_read: false, read_at: null, channel: 'in_app', created_at: '2026-10-04T08:00:00Z', related_entity_type: 'consultation', related_entity_id: 'visit-1' };
describe('safe notification presentation', () => {
  it('uses fixed role-aware consultation and follow-up destinations', () => {
    expect(notificationDestination(item, 'patient')?.to).toBe('/consultations');
    expect(notificationDestination(item, 'doctor')?.to).toBe('/doctor/agenda');
    expect(notificationDestination({ ...item, related_entity_type: 'clinical_care_task' }, 'doctor')?.to).toBe('/doctor/pacientes');
    expect(notificationDestination({ ...item, related_entity_type: 'clinical_care_task' }, 'nurse')?.to).toBe('/nurse');
    expect(notificationDestination({ ...item, related_entity_type: 'clinical_care_task' }, 'patient')).toBeNull();
    expect(notificationDestination(item, 'admin')).toBeNull();
  });
  it('never interpolates server-provided destinations or entity ids into links', () => {
    expect(notificationDestination({ ...item, related_entity_type: 'https://example.test' }, 'patient')).toBeNull();
    expect(notificationDestination({ ...item, related_entity_id: '//example.test' }, 'patient')?.to).toBe('/consultations');
    expect(notificationDestination({ ...item, related_entity_id: null }, 'patient')).toBeNull();
  });
  it('rejects malformed counts and handles invalid timestamps', () => {
    for (const value of [-1, NaN, '3', undefined, 1.5]) expect(validUnreadCount(value)).toBe(false);
    expect(validUnreadCount(0)).toBe(true);
    expect(notificationTime('bad timestamp')).toBe('Data indisponível');
  });
});
