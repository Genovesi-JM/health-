import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_VIDEO_BASE', 'https://video.example/private'); vi.stubEnv('VITE_OPERATIONAL_HOLD', 'false'); });
afterEach(() => vi.unstubAllEnvs());
describe('server video destination boundary', () => {
  it('accepts an HTTPS server URL inside the configured provider path', async () => {
    const { approvedServerVideoRoom } = await import('./video');
    expect(approvedServerVideoRoom('https://video.example/private/KAYA-secret')).toBe('https://video.example/private/KAYA-secret');
  });
  it.each(['javascript:alert(1)', 'http://video.example/private/room', 'https://video.example.evil/private/room', 'https://video.example/private/../outside', 'https://user:secret@video.example/private/room'])('rejects unsafe destination %s', async url => {
    const { approvedServerVideoRoom } = await import('./video'); expect(() => approvedServerVideoRoom(url)).toThrow();
  });
  it('rejects a missing provider configuration', async () => {
    vi.stubEnv('VITE_VIDEO_BASE', ''); const { approvedServerVideoRoom } = await import('./video');
    expect(() => approvedServerVideoRoom('https://video.example/private/room')).toThrow('disabled');
  });
});
