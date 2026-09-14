import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../api';
import { openVideoRoom } from '../utils/video';
import { connectBluetooth, connectWifi, readBluetoothVitals, scanBluetooth } from '../utils/deviceApi';
import { assertOperationalAccess, policy } from './policy';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Phase 1 operational egress remains blocked', () => {
  it.each(['/auth/me', '/auth/refresh', '/api/v1/triage/start', '/api/v1/public/pilot-scope', 'https://example.invalid/provider'])(
    'rejects %s before reading credentials or invoking an Axios adapter', async url => {
      const storage = vi.spyOn(Storage.prototype, 'getItem');
      const adapter = vi.fn();
      await expect(api.get(url, { adapter })).rejects.toMatchObject({ code: 'KAYA_INFORMATIONAL_ONLY' });
      expect(storage).not.toHaveBeenCalled();
      expect(adapter).not.toHaveBeenCalled();
    },
  );

  it('rejects direct video and device access before provider or device operations', async () => {
    const openWindow = vi.spyOn(window, 'open');
    const fetch = vi.fn();
    const requestDevice = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('navigator', { bluetooth: { requestDevice } });

    expect(() => openVideoRoom('synthetic-visit')).toThrowError('information only');
    for (const operation of [scanBluetooth, () => connectBluetooth('synthetic-device'),
      () => readBluetoothVitals('synthetic-device'), () => connectWifi('synthetic-device')]) {
      await expect(operation()).rejects.toMatchObject({ code: 'KAYA_INFORMATIONAL_ONLY' });
    }
    expect(openWindow).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(requestDevice).not.toHaveBeenCalled();
  });

  it('cannot unlock egress through profile selection or a flag-only change', () => {
    vi.stubEnv('VITE_KAYA_CLIENT_PROFILE', 'synthetic');
    const saved = policy.feature_flags.triage;
    policy.feature_flags.triage = true;
    try {
      expect(assertOperationalAccess).toThrowError('information only');
    } finally {
      policy.feature_flags.triage = saved;
    }
  });
});
