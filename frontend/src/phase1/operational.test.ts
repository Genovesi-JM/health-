import { describe, expect, it } from 'vitest';
import { assertOperationalAccess, isOperationalHoldEnabled, OperationalAccessBlockedError } from './policy';

/**
 * The app is operational by default. The information-only hold is retained as an
 * opt-in build switch (VITE_OPERATIONAL_HOLD=true) — e.g. for a pre-launch
 * marketing build — without touching call sites. These tests pin both directions.
 */
describe('operational access gate', () => {
  it('is not held by default (operational mode)', () => {
    expect(isOperationalHoldEnabled({})).toBe(false);
    expect(() => assertOperationalAccess()).not.toThrow();
  });

  it('is held only when the opt-in flag is set', () => {
    expect(isOperationalHoldEnabled({ VITE_OPERATIONAL_HOLD: 'true' })).toBe(true);
    expect(isOperationalHoldEnabled({ VITE_OPERATIONAL_HOLD: 'false' })).toBe(false);
  });

  it('the hold error carries the informational-only code', () => {
    const err = new OperationalAccessBlockedError();
    expect(err.code).toBe('KAYA_INFORMATIONAL_ONLY');
  });
});
