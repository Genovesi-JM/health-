import type { AuthUser } from '../contexts/authSession';

type SecureStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
type Tokens = { accessToken: string | null; refreshToken: string | null; storedUser: string | null };
const SESSION_KEYS = ['access_token', 'refresh_token', 'auth_user', 'kaya_health_connection_owner', 'kaya_health_sync_cursors', 'kaya_health_last_sync'];

export class SessionChangedError extends Error {
  constructor() { super('A sessão mudou. Inicie sessão novamente.'); }
}

/** A failed write must not release the queue while sibling writes are still running. */
export async function settleSessionWrites(operations: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(operations);
  const rejected = results.find(result => result.status === 'rejected');
  if (rejected?.status === 'rejected') throw rejected.reason;
}

/** Serialize secure-storage mutations so an older write cannot finish after a newer login. */
export function createSessionCoordinator(storage: SecureStorage) {
  let version = 0;
  let writes: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const current = (expected: number) => expected === version;
  const assertCurrent = (expected: number) => { if (!current(expected)) throw new SessionChangedError(); };
  const run = <T>(expected: number, action: () => Promise<T>): Promise<T> => {
    const result = writes.then(async () => {
      assertCurrent(expected);
      const value = await action();
      assertCurrent(expected);
      return value;
    });
    writes = result.catch(() => undefined);
    return result;
  };
  const begin = () => { version += 1; listeners.forEach(listener => listener()); return version; };
  const read = async (): Promise<Tokens> => {
    const [accessToken, refreshToken, storedUser] = await Promise.all([
      storage.getItemAsync('access_token'), storage.getItemAsync('refresh_token'), storage.getItemAsync('auth_user'),
    ]);
    return { accessToken, refreshToken, storedUser };
  };
  const clear = () => settleSessionWrites(SESSION_KEYS.map(key => storage.deleteItemAsync(key)));
  return {
    version: () => version,
    current, assertCurrent,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot(expected = version) { return run(expected, read); },
    commit(expected: number, action: () => Promise<void>) { return run(expected, action); },
    replace(accessToken: string, refreshToken?: string) {
      const expected = begin();
      return run(expected, async () => {
        await clear();
        await storage.setItemAsync('access_token', accessToken);
        if (refreshToken) await storage.setItemAsync('refresh_token', refreshToken);
        return expected;
      });
    },
    invalidate(expected = version, cleanup?: () => Promise<unknown>): Promise<void> {
      if (!current(expected)) return Promise.resolve();
      const replacement = begin();
      return run(replacement, async () => { await clear(); await cleanup?.(); }).catch(failure => {
        if (current(replacement)) throw failure;
      });
    },
    cacheIdentity(expected: number, identity: (tokens: Tokens) => AuthUser) {
      return run(expected, async () => {
        const tokens = await read();
        if (!tokens.accessToken) throw new SessionChangedError();
        const user = identity(tokens);
        await storage.setItemAsync('auth_user', JSON.stringify(user));
        return user;
      });
    },
    rotate(expected: number, accessToken: string, refreshToken: string) {
      return run(expected, async () => {
        const { storedUser } = await read();
        const user = storedUser ? JSON.parse(storedUser) : null;
        await storage.setItemAsync('access_token', accessToken);
        await storage.setItemAsync('refresh_token', refreshToken);
        if (user) await storage.setItemAsync('auth_user', JSON.stringify({ ...user, access_token: accessToken, refresh_token: refreshToken }));
        return accessToken;
      });
    },
  };
}
export type SessionCoordinator = ReturnType<typeof createSessionCoordinator>;

/** Refreshes share work only within one authenticated session generation. */
export function createSessionRefresh(sessions: SessionCoordinator, exchange: (token: string) => Promise<{ access_token: string; refresh_token: string }>) {
  let running: { version: number; promise: Promise<string> } | null = null;
  return (version: number): Promise<string> => {
    sessions.assertCurrent(version);
    if (running?.version === version) return running.promise;
    const promise = (async () => {
      const snapshot = await sessions.snapshot(version);
      if (!snapshot.refreshToken) throw new Error('No refresh token');
      const response = await exchange(snapshot.refreshToken);
      sessions.assertCurrent(version);
      if (!response.access_token || !response.refresh_token || typeof response.access_token !== 'string' || typeof response.refresh_token !== 'string') {
        throw new Error('Invalid refresh response');
      }
      return sessions.rotate(version, response.access_token, response.refresh_token);
    })().finally(() => { if (running?.promise === promise) running = null; });
    running = { version, promise };
    return promise;
  };
}

export function createAuthController(options: {
  sessions: SessionCoordinator;
  readIdentity(version: number): Promise<Record<string, unknown>>;
  normalize(data: Record<string, unknown>): AuthUser;
  merge(session: AuthUser, identity: Record<string, unknown>): AuthUser;
  notify(user: AuthUser | null): void;
}) {
  const { sessions } = options;
  let currentUser: { user: AuthUser; version: number } | null = null;
  let active = false;
  const fresh = async (candidate: AuthUser, version: number) => {
    const identity = await options.readIdentity(version);
    sessions.assertCurrent(version);
    if (!active) throw new SessionChangedError();
    const id = identity.id ?? identity.user_id;
    if (id != null && String(id) !== candidate.id) throw new SessionChangedError();
    const user = await sessions.cacheIdentity(version, tokens => options.merge({
      ...candidate, access_token: tokens.accessToken!, refresh_token: tokens.refreshToken || undefined,
    }, identity));
    sessions.assertCurrent(version);
    if (!active) throw new SessionChangedError();
    currentUser = { user, version };
    options.notify(user);
    return user;
  };
  return {
    connect() {
      active = true;
      const unsubscribe = sessions.subscribe(() => { currentUser = null; if (active) options.notify(null); });
      return () => { active = false; unsubscribe(); };
    },
    async restore() {
      const version = sessions.version();
      const snapshot = await sessions.snapshot(version);
      if (!snapshot.storedUser || !snapshot.accessToken) return;
      const candidate = options.normalize({ ...JSON.parse(snapshot.storedUser), access_token: snapshot.accessToken, refresh_token: snapshot.refreshToken || undefined });
      await fresh(candidate, version);
    },
    async login(data: AuthUser) {
      const candidate = options.normalize({ ...data });
      const version = await sessions.replace(candidate.access_token, candidate.refresh_token);
      await fresh(candidate, version);
    },
    refreshUser() {
      if (!currentUser) return Promise.reject(new SessionChangedError());
      return fresh(currentUser.user, currentUser.version);
    },
    logout(cleanup?: () => Promise<unknown>) { return sessions.invalidate(sessions.version(), cleanup); },
  };
}

export function navigationIdentity(user: Pick<AuthUser, 'id' | 'role'> | null): string {
  return user ? `${user.id}:${user.role}` : 'signed-out';
}
