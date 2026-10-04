import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createSessionCoordinator, SessionChangedError, settleSessionWrites } from '../src/services/sessionCoordinator.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/health/healthSync.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup({ read, authorize, post, subscribe } = {}) {
  const values = new Map(); const requests = []; let registers = 0; let reads = 0; let permissions = 0;
  const storage = { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } };
  const sessions = createSessionCoordinator(storage);
  const api = { post: async (...args) => { requests.push(args); return post ? post(...args) : { data: { imported: args[1].records.length, updated: 0, skipped: 0 } }; } };
  const platform = { isAvailable: async () => true, requestAuthorization: async () => { permissions++; return authorize ? authorize() : true; },
    readChanges: async () => { reads++; return read ? read() : { records: [{ source: 'A', value: 123 }], cursors: { A: 'cursor-A' } }; },
    subscribe: subscribe ?? (async () => () => {}) };
  const modules = { 'expo-secure-store': storage, '../phase1/policy': { assertOperationalAccess: () => {} },
    '../services/sessionCoordinator': { settleSessionWrites },
    '../services/api': { __esModule: true, default: api, sessions }, './platformHealth': { __esModule: true, default: platform },
    './backgroundScheduler': { registerBackgroundHealthSync: async () => { registers++; }, unregisterBackgroundHealthSync: async () => {} } };
  const exports = {};
  runInNewContext(source, { exports, require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; } });
  const login = async id => {
    const version = await sessions.replace(`${id}-token`, `${id}-refresh`);
    await sessions.cacheIdentity(version, () => ({ id, email: `${id}@example.test`, role: 'patient', full_name: id, access_token: `${id}-token` }));
  };
  return { ...exports, values, sessions, login, requests, stats: () => ({ registers, reads, permissions }) };
}
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setImmediate(resolve)); } assert.fail('Expected asynchronous checkpoint was not reached'); }

test('a delayed native reading for A is never uploaded or checkpointed under B', async () => {
  const reading = deferred(); const f = setup({ read: () => reading.promise });
  await f.login('A'); f.values.set('kaya_health_connection_owner', 'A');
  const pending = f.syncHealth('A').catch(error => error);
  await until(() => f.stats().reads === 1); await f.login('B');
  reading.resolve({ records: [{ privateOwner: 'A' }], cursors: { A: 'old' } });
  assert.ok(await pending instanceof SessionChangedError);
  assert.equal(f.requests.length, 0);
  assert.equal(f.values.has('kaya_health_sync_cursors'), false);
});

test('a delayed permission grant cannot restore old health ownership after account replacement', async () => {
  const permission = deferred(); const f = setup({ authorize: () => permission.promise });
  await f.login('A'); const pending = f.connectHealth('A').catch(error => error);
  await until(() => f.stats().permissions === 1); await f.login('B'); permission.resolve(true);
  assert.ok(await pending instanceof SessionChangedError);
  assert.equal(f.values.has('kaya_health_connection_owner'), false);
  assert.equal(f.stats().registers, 0);
});

test('account replacement during a batch prevents later batches and old cursor writes', async () => {
  const first = deferred(); const f = setup({
    read: async () => ({ records: Array.from({ length: 501 }, (_, id) => ({ id })), cursors: { A: 'old' } }),
    post: () => first.promise,
  });
  await f.login('A'); f.values.set('kaya_health_connection_owner', 'A');
  const version = f.sessions.version(); const pending = f.syncHealth('A').catch(error => error);
  await until(() => f.requests.length === 1); await f.login('B');
  first.resolve({ data: { imported: 500, updated: 0, skipped: 0 } });
  assert.ok(await pending instanceof SessionChangedError);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0][2]._sessionVersion, version);
  assert.equal(f.values.has('kaya_health_sync_cursors'), false);
});

test('current-owner sync preserves the API session binding and commits its cursors only after success', async () => {
  const f = setup(); await f.login('A'); await f.connectHealth('A');
  const result = await f.syncHealth('A');
  assert.equal(result.imported, 1);
  assert.equal(f.requests[0][2]._sessionVersion, f.sessions.version());
  assert.equal(JSON.parse(f.values.get('kaya_health_sync_cursors')).A, 'cursor-A');
  assert.equal(f.values.get('kaya_health_last_sync'), result.lastSync);
  await f.disconnectHealth(); assert.equal(f.values.has('kaya_health_connection_owner'), false);
});

test('an old UI callback cannot connect or read health data for a different authenticated owner', async () => {
  const f = setup(); await f.login('B'); f.values.set('kaya_health_connection_owner', 'A');
  await assert.rejects(() => f.connectHealth('A'), /health_session_changed/);
  await assert.rejects(() => f.syncHealth('A'), /health_session_changed/);
  assert.equal(f.stats().permissions, 0); assert.equal(f.stats().reads, 0);
});

test('subscriptions completing after account change are detached and cannot trigger old callbacks', async () => {
  const subscription = deferred(); let callback; let cancelled = false; let changes = 0;
  const f = setup({ subscribe: change => { callback = change; return subscription.promise; } });
  await f.login('A'); const pending = f.subscribeToHealthChanges(() => { changes++; });
  await f.login('B'); callback(); subscription.resolve(() => { cancelled = true; }); await pending;
  assert.equal(changes, 0); assert.equal(cancelled, true);
});
