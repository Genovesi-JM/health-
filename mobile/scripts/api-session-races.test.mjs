import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as sessionCoordinator from '../src/services/sessionCoordinator.ts';
import { isMfaSessionError } from '../src/contexts/authSession.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup({ hold = false, refresh } = {}) {
  const values = new Map(); const handlers = {}; const replayed = []; const exchanges = [];
  const storage = { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } };
  const client = { interceptors: { request: { use: handler => { handlers.request = handler; } },
    response: { use: (ok, error) => { handlers.ok = ok; handlers.error = error; } } },
    request: async config => { replayed.push(config); return { config, data: 'replayed' }; } };
  const axios = { create: () => client, post: async (...args) => { exchanges.push(args); return refresh ? refresh(...args) : { data: { access_token: 'rotated', refresh_token: 'rotated-refresh' } }; } };
  const modules = { axios, 'expo-secure-store': storage,
    '../phase1/policy': { assertOperationalAccess: () => { if (hold) throw new Error('HOLD'); } },
    '../config/apiUrl': { resolveApiBaseUrl: () => 'https://synthetic.invalid' },
    '../contexts/authSession': { isMfaSessionError }, './sessionCoordinator': sessionCoordinator };
  const exports = {};
  runInNewContext(source, { exports, require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; }, process: { env: {} }, __DEV__: true });
  return { ...exports, values, handlers, replayed, exchanges };
}
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setImmediate(resolve)); } assert.fail('Expected asynchronous checkpoint was not reached'); }

test('actual API interceptors reject late A data and MFA/401 errors without clearing account B', async () => {
  const f = setup(); await f.saveTokens('A-token', 'A-refresh');
  const original = await f.handlers.request({ url: '/api/v1/patient-documents', headers: {} });
  assert.equal(original.headers.Authorization, 'Bearer A-token');
  await f.saveTokens('B-token', 'B-refresh');
  assert.throws(() => f.handlers.ok({ config: original, data: 'A private documents' }), sessionCoordinator.SessionChangedError);
  for (const status of [401, 403]) {
    await assert.rejects(() => f.handlers.error({ config: original, response: { status, headers: { 'x-kaya-error-code': 'session_role_changed' } } }), sessionCoordinator.SessionChangedError);
  }
  assert.equal(f.values.get('access_token'), 'B-token');
  assert.equal(f.exchanges.length, 0);
  assert.equal(f.replayed.length, 0);
});

test('actual interceptor never retries an A request under B after a late token refresh', async () => {
  const exchange = deferred();
  const f = setup({ refresh: () => exchange.promise });
  await f.saveTokens('A-token', 'A-refresh');
  const original = await f.handlers.request({ url: '/api/v1/patient-documents', headers: {} });
  const pending = f.handlers.error({ config: original, response: { status: 401 } }).catch(error => error);
  await until(() => f.exchanges.length === 1);
  await f.saveTokens('B-token', 'B-refresh');
  exchange.resolve({ data: { access_token: 'A-late', refresh_token: 'A-late-refresh' } });
  await pending;
  assert.equal(f.values.get('access_token'), 'B-token');
  assert.equal(f.values.get('refresh_token'), 'B-refresh');
  assert.equal(f.replayed.length, 0);
});

test('actual interceptor refreshes the current session once and preserves request identity', async () => {
  const f = setup(); await f.saveTokens('A-token', 'A-refresh');
  const original = await f.handlers.request({ url: '/api/v1/consultations/book', data: { slot_id: 'slot' }, headers: { 'Idempotency-Key': 'stable-request' } });
  await f.handlers.error({ config: original, response: { status: 401 } });
  assert.equal(f.exchanges.length, 1);
  assert.equal(f.exchanges[0][1].refresh_token, 'A-refresh');
  assert.equal(f.replayed.length, 1);
  assert.equal(f.replayed[0].headers.Authorization, 'Bearer rotated');
  assert.equal(f.replayed[0].headers['Idempotency-Key'], 'stable-request');
  assert.equal(f.replayed[0].data.slot_id, 'slot');
  assert.equal(f.replayed[0]._sessionVersion, f.sessions.version());
});

test('current MFA invalidation notifies the provider and clears only its current session', async () => {
  const f = setup(); await f.saveTokens('A-token', 'A-refresh');
  const original = await f.handlers.request({ url: '/auth/me', headers: {} });
  let invalidated = false; f.sessions.subscribe(() => { invalidated = true; });
  const error = { config: original, response: { status: 403, headers: { 'x-kaya-error-code': 'mfa_verification_required' } } };
  await assert.rejects(() => f.handlers.error(error));
  assert.equal(invalidated, true);
  assert.equal(f.values.has('access_token'), false);
  assert.equal(f.values.has('refresh_token'), false);
});

test('HOLD still blocks operational requests before authentication or token refresh', async () => {
  const f = setup({ hold: true });
  await assert.rejects(() => f.handlers.request({ url: '/api/v1/patient-documents', headers: {} }), /HOLD/);
  assert.equal(f.exchanges.length, 0);
  assert.equal(f.replayed.length, 0);
});
