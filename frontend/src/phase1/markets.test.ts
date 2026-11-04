import { describe, expect, it } from 'vitest';
import * as web from './policy';
import * as mobile from '../../../mobile/src/phase1/policy';

// Both clients consume generated copies of the same country planning contract.
describe.each([['web', web], ['mobile', mobile]] as const)('%s target markets', (_, client) => {
  it('prioritizes Angola and prepares Portugal without changing release approval', () => {
    expect(client.policy.planning.target_markets.map(market => market.country_code)).toEqual(['AO', 'PT']);
    expect(client.getTargetMarket('AO')).toMatchObject({
      launch_role: 'primary', initial_city: 'Luanda', locale: 'pt-AO', currency: 'AOA',
    });
    expect(client.getTargetMarket('PT')).toMatchObject({
      launch_role: 'preparation', initial_city: null, locale: 'pt-PT', currency: 'EUR',
    });
    expect(client.policy.release.approved_jurisdictions).toEqual([]);
    expect(Object.values(client.policy.feature_flags).every(enabled => enabled === false)).toBe(true);
  });

  it.each([undefined, null, '', 'ao', 'PT ', 'ES', 'pt-PT', 'EUR', 'Europe/Lisbon', true])(
    'never infers a market from %s', value => {
      expect(client.getTargetMarket(value)).toBeUndefined();
      expect(client.isTargetMarketTimezone(value, 'Africa/Luanda')).toBe(false);
    },
  );

  it('requires an explicit clinic zone from the chosen market', () => {
    expect(client.isTargetMarketTimezone('AO', 'Africa/Luanda')).toBe(true);
    expect(client.isTargetMarketTimezone('AO', 'Europe/Lisbon')).toBe(false);
    expect(client.isTargetMarketTimezone('PT', 'Africa/Luanda')).toBe(false);
    expect(client.isTargetMarketTimezone('PT', undefined)).toBe(false);
    expect(client.isTargetMarketTimezone('PT', 'UTC+1')).toBe(false);
    for (const zone of ['Europe/Lisbon', 'Atlantic/Madeira', 'Atlantic/Azores']) {
      expect(client.isTargetMarketTimezone('PT', zone)).toBe(true);
    }
  });

  it('supports date-dependent Portuguese offsets instead of a fixed country offset', () => {
    const localHour = (date: string, timeZone: string) =>
      new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(date));
    const winter = '2026-01-15T12:00:00Z';
    const summer = '2026-07-15T12:00:00Z';
    for (const zone of client.getTargetMarket('PT')!.timezones) {
      const azores = zone === 'Atlantic/Azores';
      expect(localHour(winter, zone)).toBe(azores ? '11' : '12');
      expect(localHour(summer, zone)).toBe(azores ? '12' : '13');
    }
    const angolaZone = client.getTargetMarket('AO')!.timezones[0];
    expect(localHour(winter, angolaZone)).toBe('13');
    expect(localHour(summer, angolaZone)).toBe('13');
  });
});
