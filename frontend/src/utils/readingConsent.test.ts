import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { checkReadingConsent, isReadingConsentDenial, readingScope } from './readingConsent';
import { readingsConsentState } from './readingConsent.test-fixtures';
vi.mock('../api', () => ({ default: { get: vi.fn() } }));
const options = { device: false, current: () => true, headers: { Authorization: 'Bearer captured-A' } };
beforeEach(() => vi.resetAllMocks());
it('requires an explicit supported scope and never substitutes a profile market', () => {
  expect(readingScope('PT')).toEqual({ country: 'PT', consent_language: 'pt' });
  for (const value of [undefined, null, '', 'AO-legacy', 'Brazil']) expect(() => readingScope(value)).toThrow('Escolha');
});
it('uses the selected scope and captured credential for preflight', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: readingsConsentState('PT', false) });
  await checkReadingConsent(readingScope('PT'), options);
  expect(api.get).toHaveBeenCalledWith('/api/v1/compliance/consent-state', { headers: options.headers, params: { country: 'PT', language: 'pt' } });
});
it('does not interpret five required grants as the optional devices grant', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: readingsConsentState('AO', false) });
  await expect(checkReadingConsent(readingScope('AO'), { ...options, device: true })).rejects.toThrow('decisão separada');
});
it('blocks acquisition on a withdrawn devices grant', async () => {
  const state = readingsConsentState(); const devices = state.states.find(item => item.purpose === 'devices')!;
  devices.status = 'withdrawn'; devices.effective = false; devices.latest_event!.action = 'withdraw';
  vi.mocked(api.get).mockResolvedValue({ data: state });
  await expect(checkReadingConsent(readingScope('AO'), { ...options, device: true })).rejects.toThrow('decisão separada');
});
it('rejects a valid response belonging to another market', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: readingsConsentState('AO') });
  await expect(checkReadingConsent(readingScope('PT'), options)).rejects.toThrow('validar');
});
it('rejects a response after the owning session changed', async () => {
  let current = true;
  vi.mocked(api.get).mockImplementation(async () => { current = false; return { data: readingsConsentState() }; });
  await expect(checkReadingConsent(readingScope('AO'), { ...options, current: () => current })).rejects.toThrow('sessão ou o país');
});
it('distinguishes fresh-write consent denial from lost authority to personal history', () => {
  expect(isReadingConsentDenial({ response: { status: 403, data: { detail: { code: 'consent_required' } } } })).toBe(true);
  for (const value of [null, new Error('offline'), { response: { status: 401 } }, { response: { status: 403, data: { detail: 'denied' } } }]) expect(isReadingConsentDenial(value)).toBe(false);
});
