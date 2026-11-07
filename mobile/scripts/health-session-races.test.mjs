import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { readingHelpers, readingState, scope, connection } from './readings-fixtures.mjs';
import { createSessionCoordinator, SessionChangedError, settleSessionWrites } from '../src/services/sessionCoordinator.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/health/healthSync.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup({ read, authorize, post, subscribe, get } = {}) {
  const values = new Map(); const requests = []; let registers = 0; let reads = 0; let permissions = 0;
  const storage = { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } };
  const sessions = createSessionCoordinator(storage);
  const api = { get: async (...args) => get ? get(...args) : { data: readingState(args[0].includes('country=PT') ? 'PT' : 'AO') }, post: async (...args) => { requests.push(args); return post ? post(...args) : { data: { imported: args[1].records.length, updated: 0, skipped: 0 } }; } };
  const platform = { isAvailable: async () => true, requestAuthorization: async () => { permissions++; return authorize ? authorize() : true; },
    readChanges: async () => { reads++; return read ? read() : { records: [{ source: 'A', value: 123 }], cursors: { A: 'cursor-A' } }; },
    subscribe: subscribe ?? (async () => () => {}) };
  const modules = { 'expo-secure-store': storage, '../phase1/policy': { assertOperationalAccess: () => {} },
    '../services/sessionCoordinator': { settleSessionWrites }, '../screens/readings': readingHelpers,
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
  await f.login('A'); f.values.set('kaya_health_connection_owner', connection());
  const pending = f.syncHealth('A').catch(error => error);
  await until(() => f.stats().reads === 1); await f.login('B');
  reading.resolve({ records: [{ privateOwner: 'A' }], cursors: { A: 'old' } });
  assert.ok(await pending instanceof SessionChangedError);
  assert.equal(f.requests.length, 0);
  assert.equal(f.values.has('kaya_health_sync_cursors'), false);
});

test('a delayed permission grant cannot restore old health ownership after account replacement', async () => {
  const permission = deferred(); const f = setup({ authorize: () => permission.promise });
  await f.login('A'); const pending = f.connectHealth('A', scope('AO')).catch(error => error);
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
  await f.login('A'); f.values.set('kaya_health_connection_owner', connection());
  const version = f.sessions.version(); const pending = f.syncHealth('A').catch(error => error);
  await until(() => f.requests.length === 1); await f.login('B');
  first.resolve({ data: { imported: 500, updated: 0, skipped: 0 } });
  assert.ok(await pending instanceof SessionChangedError);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0][2]._sessionVersion, version);
  assert.equal(f.values.has('kaya_health_sync_cursors'), false);
});

test('current-owner sync preserves the API session binding and commits its cursors only after success', async () => {
  const f = setup(); await f.login('A'); await f.connectHealth('A', scope('AO'));
  const result = await f.syncHealth('A');
  assert.equal(result.imported, 1);
  assert.equal(f.requests[0][2]._sessionVersion, f.sessions.version());
  assert.equal(JSON.parse(f.values.get('kaya_health_sync_cursors')).A, 'cursor-A');
  assert.equal(f.values.get('kaya_health_last_sync'), result.lastSync);
  await f.disconnectHealth(); assert.equal(f.values.has('kaya_health_connection_owner'), false);
});

test('an old UI callback cannot connect or read health data for a different authenticated owner', async () => {
  const f = setup(); await f.login('B'); f.values.set('kaya_health_connection_owner', connection());
  await assert.rejects(() => f.connectHealth('A', scope('AO')), /health_session_changed/);
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

test('withdrawn devices authorization stops before native permission, reading or cursor changes', async () => {
  const f = setup({ get: async () => ({ data: readingState('AO', false) }) });
  await f.login('A');
  await assert.rejects(() => f.connectHealth('A', scope('AO')), readingHelpers.readingConsentRequired);
  f.values.set('kaya_health_connection_owner', connection());
  f.values.set('kaya_health_sync_cursors', JSON.stringify({ A: 'retained' }));
  await assert.rejects(() => f.syncHealth('A'), readingHelpers.readingConsentRequired);
  assert.equal(f.stats().permissions, 0); assert.equal(f.stats().reads, 0); assert.equal(f.requests.length, 0);
  assert.equal(JSON.parse(f.values.get('kaya_health_sync_cursors')).A, 'retained');
});
test('a legacy owner-only connection cannot read samples or silently choose a market', async () => {
  const f = setup(); await f.login('A'); f.values.set('kaya_health_connection_owner', 'A');
  assert.equal(await f.isHealthConnected('A'), false); assert.equal(await f.getHealthConnectionOwner(), null);
  await assert.rejects(() => f.syncHealth('A'), /explicitamente/); assert.equal(f.stats().reads, 0);
});
test('all batches preserve the configured market and source identity and simultaneous syncs share one operation', async () => {
  const read = deferred(); const f = setup({ read: () => read.promise }); await f.login('A'); await f.connectHealth('A', scope('PT'));
  const first = f.syncHealth('A'); const second = f.syncHealth('A'); assert.equal(first, second);
  await until(() => f.stats().reads === 1);
  const records = Array.from({ length: 501 }, (_, id) => ({ external_id: String(id), source: 'apple_health', value: id }));
  read.resolve({ records, cursors: { A: 'PT-cursor' } }); await first;
  assert.equal(f.requests.length, 2);
  for (const [path, body] of f.requests) { assert.equal(path, '/api/v1/readings/sync'); assert.equal(body.country, 'PT'); assert.equal(body.consent_language, 'pt'); }
  assert.deepEqual(f.requests.flatMap(([, body]) => body.records), records);
  await assert.rejects(() => f.connectHealth('A', scope('AO')), /Desligue/);
  assert.equal((await f.getHealthConnection('A')).country, 'PT');
});
test('disconnect while the OS reads invalidates the batch before POST and cannot restore cursors', async () => {
  const read = deferred(); const f = setup({ read: () => read.promise }); await f.login('A'); await f.connectHealth('A', scope('AO'));
  const pending = f.syncHealth('A').catch(error => error); await until(() => f.stats().reads === 1); await f.disconnectHealth();
  read.resolve({ records: [{ source: 'apple_health', external_id: 'old' }], cursors: { A: 'old' } });
  assert.match((await pending).message, /ligação de saúde mudou/); assert.equal(f.requests.length, 0);
  assert.equal(f.values.has('kaya_health_sync_cursors'), false); assert.equal(await f.isHealthConnected('A'), false);
});
test('a rejected or uncertain batch keeps its previous cursor and future attempts check consent again', async () => {
  let allowed = true; let reads = 0;
  const f = setup({ get: async () => { reads++; return { data: readingState('AO', allowed) }; }, post: async () => { throw { response: { status: 409, data: { detail: { code: 'reading_scope_conflict' } } } }; } });
  await f.login('A'); await f.connectHealth('A', scope('AO')); f.values.set('kaya_health_sync_cursors', JSON.stringify({ A: 'retained' }));
  await assert.rejects(() => f.syncHealth('A')); const after = reads; allowed = false;
  await assert.rejects(() => f.syncHealth('A'), readingHelpers.readingConsentRequired);
  assert.ok(reads > after); assert.equal(f.stats().reads, 1); assert.equal(f.requests.length, 1);
  assert.equal(JSON.parse(f.values.get('kaya_health_sync_cursors')).A, 'retained');
});
test('account replacement during consent lookup prevents platform permission and sample access', async () => {
  const response = deferred(); let requested = false;
  const f = setup({ get: () => { requested = true; return response.promise; } }); await f.login('A');
  const pending = f.connectHealth('A', scope('AO')).catch(error => error); await until(() => requested);
  await f.login('B'); response.resolve({ data: readingState() }); assert.ok(await pending instanceof SessionChangedError);
  assert.equal(f.stats().permissions, 0); assert.equal(f.stats().reads, 0); assert.equal(f.requests.length, 0);
});
test('reconfirming the same scoped connection preserves existing cursors', async () => {
  const f = setup(); await f.login('A'); await f.connectHealth('A', scope('AO'));
  f.values.set('kaya_health_sync_cursors', JSON.stringify({ A: 'same-scope' }));
  await f.connectHealth('A', scope('AO'));
  assert.equal(JSON.parse(f.values.get('kaya_health_sync_cursors')).A, 'same-scope');
});
