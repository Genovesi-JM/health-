import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionCoordinator, createAuthController, createSessionRefresh, SessionChangedError } from '../src/services/sessionCoordinator.ts';
import { normalizeAuth, mergeSessionIdentity } from '../src/contexts/authSession.ts';

const account = id => ({ id, email: `${id}@example.test`, role: 'patient', full_name: id, access_token: `${id}-token`, refresh_token: `${id}-refresh` });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(initial = null) {
  const values = new Map(initial ? [['access_token', initial.access_token], ['refresh_token', initial.refresh_token], ['auth_user', JSON.stringify(initial)]] : []);
  const storage = { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } };
  const sessions = createSessionCoordinator(storage);
  const reads = [];
  const notifications = [];
  const controller = createAuthController({ sessions, normalize: normalizeAuth, merge: mergeSessionIdentity,
    notify: user => notifications.push(user), readIdentity: async version => {
      const request = { version, ...deferred() }; reads.push(request); return request.promise;
    } });
  const disconnect = controller.connect();
  return { values, storage, sessions, controller, reads, notifications, disconnect };
}
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setImmediate(resolve)); } assert.fail('Expected asynchronous checkpoint was not reached'); }
async function signIn(f, user) {
  const count = f.reads.length;
  const pending = f.controller.login(user);
  await until(() => f.reads.length > count);
  f.reads.at(-1).resolve(user);
  await pending;
}

test('late restoration cannot resurrect A after logout and a successful login B', async () => {
  const f = fixture(account('A'));
  const restoration = f.controller.restore().catch(error => error);
  await until(() => f.reads.length === 1);
  const old = f.reads[0];
  await f.controller.logout();
  await signIn(f, account('B'));
  old.resolve(account('A'));
  assert.ok(await restoration instanceof SessionChangedError);
  assert.equal(f.notifications.at(-1).id, 'B');
  assert.equal(JSON.parse(f.values.get('auth_user')).id, 'B');
  assert.equal(f.values.get('access_token'), 'B-token');
});

test('late refreshUser cannot combine identity A with account B tokens', async () => {
  const f = fixture(); await signIn(f, account('A'));
  const pending = f.controller.refreshUser().catch(error => error);
  await until(() => f.reads.length === 2);
  const old = f.reads[1];
  await f.controller.logout(); await signIn(f, account('B'));
  old.resolve(account('A'));
  assert.ok(await pending instanceof SessionChangedError);
  assert.equal(f.notifications.at(-1).id, 'B');
  assert.equal(JSON.parse(f.values.get('auth_user')).id, 'B');
});

test('concurrent sign-ins publish only the latest identity', async () => {
  const f = fixture();
  const first = f.controller.login(account('A')).catch(error => error);
  await until(() => f.reads.length === 1);
  await signIn(f, account('B'));
  f.reads[0].resolve(account('A'));
  assert.ok(await first instanceof SessionChangedError);
  assert.deepEqual(f.notifications.filter(Boolean).map(user => user.id), ['B']);
});

test('logout hides the user immediately and serializes slow cleanup before the next login', async () => {
  const f = fixture(); await signIn(f, account('A'));
  const cleanup = deferred(); let cleaning = false;
  const logout = f.controller.logout(async () => { cleaning = true; await cleanup.promise; });
  assert.equal(f.notifications.at(-1), null);
  await until(() => cleaning);
  const login = f.controller.login(account('B'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.reads.length, 1);
  cleanup.resolve(); await logout;
  await until(() => f.reads.length === 2); f.reads[1].resolve(account('B')); await login;
  assert.equal(f.notifications.at(-1).id, 'B');
  assert.equal(f.values.get('access_token'), 'B-token');
});

test('an in-flight secure-storage write finishes before the replacement account writes', async () => {
  const f = fixture(); await signIn(f, account('A'));
  const gate = deferred(); let writing = false;
  const set = f.storage.setItemAsync;
  f.storage.setItemAsync = async (key, value) => {
    if (key === 'auth_user' && JSON.parse(value).id === 'A') { writing = true; await gate.promise; }
    return set(key, value);
  };
  const refresh = f.controller.refreshUser().catch(error => error);
  await until(() => f.reads.length === 2); f.reads[1].resolve(account('A'));
  await until(() => writing);
  const login = f.controller.login(account('B'));
  gate.resolve();
  await until(() => f.reads.length === 3); f.reads[2].resolve(account('B')); await login;
  assert.ok(await refresh instanceof SessionChangedError);
  assert.equal(JSON.parse(f.values.get('auth_user')).id, 'B');
  assert.equal(f.values.get('access_token'), 'B-token');
});

test('missing refresh token on a new login removes the previous account token and health ownership', async () => {
  const f = fixture(); await signIn(f, account('A'));
  f.values.set('kaya_health_connection_owner', 'A');
  await signIn(f, { ...account('B'), refresh_token: undefined });
  assert.equal(f.values.has('refresh_token'), false);
  assert.equal(f.values.has('kaya_health_connection_owner'), false);
  assert.equal(JSON.parse(f.values.get('auth_user')).refresh_token, undefined);
});

test('a failed clear waits for all old deletes before allowing a newer login to persist', async () => {
  const f = fixture(); await signIn(f, account('A'));
  const delayedDelete = deferred(); let started = false; let failed = false;
  const remove = f.storage.deleteItemAsync;
  f.storage.deleteItemAsync = async key => {
    if (key === 'access_token' && !started) { started = true; await delayedDelete.promise; }
    if (key === 'refresh_token' && !failed) { failed = true; throw new Error('Synthetic secure-storage failure'); }
    await remove(key);
  };
  const logout = f.controller.logout();
  await until(() => started && failed);
  const login = f.controller.login(account('B'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.reads.length, 1, 'B must wait until the outstanding A delete settles');
  delayedDelete.resolve(); await logout;
  await until(() => f.reads.length === 2); f.reads[1].resolve(account('B')); await login;
  assert.equal(f.values.get('access_token'), 'B-token');
  assert.equal(f.values.get('refresh_token'), 'B-refresh');
  assert.equal(JSON.parse(f.values.get('auth_user')).id, 'B');
});

test('late token refresh and a stale MFA invalidation cannot alter a newer account', async () => {
  const f = fixture(); await signIn(f, account('A'));
  const version = f.sessions.version();
  const exchange = deferred(); let started = false;
  const refresh = createSessionRefresh(f.sessions, async token => { assert.equal(token, 'A-refresh'); started = true; return exchange.promise; });
  const pending = refresh(version).catch(error => error);
  await until(() => started);
  await signIn(f, account('B'));
  exchange.resolve({ access_token: 'A-late', refresh_token: 'A-late-refresh' });
  assert.ok(await pending instanceof SessionChangedError);
  await f.sessions.invalidate(version);
  assert.equal(f.values.get('access_token'), 'B-token');
  assert.equal(JSON.parse(f.values.get('auth_user')).id, 'B');
  assert.equal(f.notifications.at(-1).id, 'B');
});

test('refresh work is shared only within its own session and cannot cancel newer refresh work', async () => {
  const f = fixture(); await signIn(f, account('A'));
  const exchanges = [];
  const refresh = createSessionRefresh(f.sessions, async token => { const item = { token, ...deferred() }; exchanges.push(item); return item.promise; });
  const a = refresh(f.sessions.version());
  const aResult = a.catch(error => error);
  assert.equal(refresh(f.sessions.version()), a);
  await until(() => exchanges.length === 1);
  await signIn(f, account('B'));
  const b = refresh(f.sessions.version());
  await until(() => exchanges.length === 2);
  exchanges[0].reject(new Error('Old refresh rejected'));
  await aResult;
  assert.equal(refresh(f.sessions.version()), b);
  exchanges[1].resolve({ access_token: 'B-rotated', refresh_token: 'B-rotated-refresh' });
  assert.equal(await b, 'B-rotated');
  assert.equal(f.values.get('access_token'), 'B-rotated');
  assert.equal(JSON.parse(f.values.get('auth_user')).access_token, 'B-rotated');
});

test('identity mismatch or provider disposal cannot publish or cache an unverified identity', async () => {
  for (const disposed of [false, true]) {
    const f = fixture(); const pending = f.controller.login(account('A')).catch(error => error);
    await until(() => f.reads.length === 1);
    if (disposed) f.disconnect();
    f.reads[0].resolve(account(disposed ? 'A' : 'B'));
    assert.ok(await pending instanceof SessionChangedError);
    assert.equal(f.notifications.filter(Boolean).length, 0);
    assert.equal(f.values.has('auth_user'), false);
  }
});
