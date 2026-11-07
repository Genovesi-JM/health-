import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession } from '../api';
import { readPendingAppointment, savePendingAppointment } from './pendingAppointment';
const pending = { key: '2e62ae58-f209-4324-8d48-1e4d752a492a', payload: { country: 'AO', specialty: 'clinica_geral', slot_id: 'slot-1' } };
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
describe('pending booking account isolation', () => {
  it('persists only the minimum request for the owning account and nothing in local storage', () => {
    savePendingAppointment('patient-1', pending);
    expect(readPendingAppointment('patient-1')).toEqual(pending);
    expect(readPendingAppointment('patient-2')).toBeNull();
    expect(localStorage.length).toBe(0);
  });
  it('clears pending references on explicit logout while retaining unrelated session state', () => {
    savePendingAppointment('patient-1', pending); sessionStorage.setItem('unrelated', 'keep');
    clearSession();
    expect(readPendingAppointment('patient-1')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  });
  it('preserves the original key during required reauthentication', () => {
    savePendingAppointment('patient-1', pending); localStorage.setItem('ht_token', 'expired');
    clearSession({ preservePendingAppointments: true });
    expect(readPendingAppointment('patient-1')).toEqual(pending);
    expect(localStorage.getItem('ht_token')).toBeNull();
  });
  it('rejects malformed recovery records and empty account identities', () => {
    sessionStorage.setItem('kaya_pending_appointment:patient-1', JSON.stringify({ ...pending, payload: { ...pending.payload, notes: 'unexpected' } }));
    expect(() => readPendingAppointment('patient-1')).toThrow();
    expect(() => savePendingAppointment('', pending)).toThrow();
  });
});
