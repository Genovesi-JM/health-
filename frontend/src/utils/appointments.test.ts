import { describe, expect, it } from 'vitest';
import { clinicOffsetTimestamp, clinicTimeCandidates, formatAppointmentTime } from './appointments';

describe('clinic wall-time conversion', () => {
  it('keeps Angola wall time independent of the browser zone', () => {
    expect(clinicTimeCandidates('2026-12-01T09:30', 'Africa/Luanda')).toEqual(['2026-12-01T08:30:00.000Z']);
    expect(clinicOffsetTimestamp('2026-12-01T08:30:00.000Z', 'Africa/Luanda')).toBe('2026-12-01T09:30:00+01:00');
  });
  it('uses date-dependent Portugal offsets', () => {
    expect(clinicTimeCandidates('2026-07-15T09:30', 'Europe/Lisbon')).toEqual(['2026-07-15T08:30:00.000Z']);
    expect(clinicTimeCandidates('2026-12-15T09:30', 'Europe/Lisbon')).toEqual(['2026-12-15T09:30:00.000Z']);
    expect(clinicTimeCandidates('2026-12-15T09:30', 'Atlantic/Azores')).toEqual(['2026-12-15T10:30:00.000Z']);
  });
  it('rejects a skipped spring hour and invalid calendar dates', () => {
    expect(clinicTimeCandidates('2026-03-29T01:30', 'Europe/Lisbon')).toEqual([]);
    expect(clinicTimeCandidates('2026-02-30T09:30', 'Africa/Luanda')).toEqual([]);
  });
  it('offers both occurrences of a repeated autumn hour explicitly', () => {
    expect(clinicTimeCandidates('2026-10-25T01:30', 'Europe/Lisbon')).toEqual(['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']);
    expect(clinicOffsetTimestamp('2026-10-25T00:30:00.000Z', 'Europe/Lisbon')).toBe('2026-10-25T01:30:00+01:00');
    expect(clinicOffsetTimestamp('2026-10-25T01:30:00.000Z', 'Europe/Lisbon')).toBe('2026-10-25T01:30:00+00:00');
  });
  it('shows clinic zone and different offsets for repeated hours', () => {
    expect(formatAppointmentTime('2026-10-25T00:30:00Z', 'Europe/Lisbon')).toContain('GMT+1');
    expect(formatAppointmentTime('2026-10-25T01:30:00Z', 'Europe/Lisbon')).not.toContain('GMT+1');
    expect(formatAppointmentTime('2026-12-01T08:30:00Z', 'Africa/Luanda')).toContain('Africa/Luanda');
  });
});
