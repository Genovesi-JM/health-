import { beforeEach, expect, it } from 'vitest';
import { AxiosError, type AxiosAdapter } from 'axios';
import api, { getSession, persistSession } from './api';
beforeEach(() => localStorage.clear());
it('replaces all refresh credentials when switching to a session without a refresh token', () => {
  persistSession({ access_token: 'old-access', refresh_token: 'old-refresh', user: { id: 'old', email: 'old@example.test', role: 'doctor' } });
  persistSession({ access_token: 'new-access', user: { id: 'new', email: 'new@example.test', role: 'patient' } });
  expect(getSession()).toMatchObject({ token: 'new-access', userId: 'new', role: 'patient' });
  expect(localStorage.getItem('ht_refresh_token')).toBeNull();
});

it.each([401, 403])('does not clear a new account when an old request returns %s', async status => {
  persistSession({ access_token: 'old-access', user: { id: 'old', email: 'old@example.test', role: 'doctor' } });
  let failRequest: () => void = () => { throw new Error('Request did not start'); };
  let started: () => void = () => {};
  const requestStarted = new Promise<void>(resolve => { started = resolve; });
  const adapter: AxiosAdapter = config => new Promise((_resolve, reject) => {
    failRequest = () => reject(new AxiosError('Expired session', 'ERR_BAD_REQUEST', config, undefined, {
      status, statusText: 'Unauthorized', config, data: {}, headers: { 'x-kaya-error-code': 'mfa_verification_required' },
    }));
    started();
  });
  const request = api.get('/auth/me', { adapter });
  const assertion = expect(request).rejects.toThrow('Expired session');
  await requestStarted;
  persistSession({ access_token: 'new-access', user: { id: 'new', email: 'new@example.test', role: 'patient' } });
  failRequest();
  await assertion;
  expect(getSession()).toMatchObject({ token: 'new-access', userId: 'new' });
});

it('still clears the current rejected session', async () => {
  window.history.replaceState({}, '', '/login');
  persistSession({ access_token: 'current-access', user: { id: 'current', email: 'current@example.test', role: 'doctor' } });
  const adapter: AxiosAdapter = config => Promise.reject(new AxiosError('Expired session', 'ERR_BAD_REQUEST', config, undefined, {
    status: 401, statusText: 'Unauthorized', config, data: {}, headers: {},
  }));
  await expect(api.get('/auth/me', { adapter })).rejects.toThrow('Expired session');
  expect(getSession()).toBeNull();
});
