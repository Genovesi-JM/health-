import * as SecureStore from 'expo-secure-store';
import { assertOperationalAccess } from '../phase1/policy';
import api, { sessions } from '../services/api';
import type { AxiosRequestConfig } from 'axios';
import { settleSessionWrites } from '../services/sessionCoordinator';
import { parseHealthConnection, readingScope, requireReadingConsent } from '../screens/readings';
import type { HealthConnection, ReadingScope } from '../screens/readings';
import platformHealth from './platformHealth';
import type { HealthCursors } from './types';
import {
  registerBackgroundHealthSync,
  unregisterBackgroundHealthSync,
} from './backgroundScheduler';

const OWNER_KEY = 'kaya_health_connection_owner';
const CURSORS_KEY = 'kaya_health_sync_cursors';
const LAST_SYNC_KEY = 'kaya_health_last_sync';
let connectionEpoch = 0;
let connecting = false;
let running: { userId: string; version: number; epoch: number; promise: Promise<HealthSyncResult> } | null = null;

function assertConnection(version: number, epoch: number) {
  sessions.assertCurrent(version);
  if (epoch !== connectionEpoch) throw new Error('A ligação de saúde mudou. Confirme a ligação antes de sincronizar.');
}
const scopedApi = (version: number) => ({
  get: (path: string) => api.get(path, { _sessionVersion: version } as AxiosRequestConfig),
});

export interface HealthSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  lastSync: string;
}

async function requireHealthSession(userId: string | number, version: number) {
  const snapshot = await sessions.snapshot(version);
  const storedUser = snapshot.storedUser ? JSON.parse(snapshot.storedUser) : null;
  if (!snapshot.accessToken || String(storedUser?.id ?? '') !== String(userId)) throw new Error('health_session_changed');
  sessions.assertCurrent(version);
}

export async function healthIsAvailable() {
  return platformHealth.isAvailable();
}

export async function isHealthConnected(userId: string | number) {
  return !!(await getHealthConnection(userId));
}

export async function getHealthConnectionOwner() {
  return (await getHealthConnection())?.ownerId ?? null;
}

export async function getHealthConnection(userId?: string | number): Promise<HealthConnection | null> {
  return parseHealthConnection(await SecureStore.getItemAsync(OWNER_KEY), userId);
}

export async function connectHealth(userId: string | number, input: ReadingScope) {
  assertOperationalAccess();
  if (connecting) throw new Error('A ligação de saúde está a ser confirmada. Aguarde.');
  const scope = readingScope(input.country, input.consent_language);
  const version = sessions.version();
  const epoch = ++connectionEpoch;
  connecting = true;
  try {
    await requireHealthSession(userId, version); assertConnection(version, epoch);
    const existing = await getHealthConnection(userId); assertConnection(version, epoch);
    if (existing && (existing.country !== scope.country || existing.consent_language !== scope.consent_language)) throw new Error('Desligue a ligação atual antes de escolher outro país. As medições existentes mantêm o país original.');
    await requireReadingConsent(scopedApi(version), scope, true, () => assertConnection(version, epoch));
    if (!(await platformHealth.isAvailable())) return false;
    assertConnection(version, epoch);
    const granted = await platformHealth.requestAuthorization();
    assertConnection(version, epoch);
    if (!granted) return false;
    await sessions.commit(version, async () => {
      assertConnection(version, epoch);
      if (!existing) {
        // Publish ownership only after legacy cursors have been removed. A failed
        // cleanup cannot bind old samples to a newly selected market.
        await settleSessionWrites([SecureStore.deleteItemAsync(OWNER_KEY), SecureStore.deleteItemAsync(CURSORS_KEY), SecureStore.deleteItemAsync(LAST_SYNC_KEY)]);
        assertConnection(version, epoch);
        await SecureStore.setItemAsync(OWNER_KEY, JSON.stringify({ ownerId: String(userId), ...scope }));
        assertConnection(version, epoch);
      }
      await registerBackgroundHealthSync().catch(() => {});
    });
    return true;
  } finally { connecting = false; }
}

export async function disconnectHealth() {
  ++connectionEpoch;
  await sessions.commit(sessions.version(), clearHealthConnection);
}

/** Auth logout invokes this inside its already serialized secure-storage cleanup. */
export async function clearHealthConnection() {
  ++connectionEpoch;
  await settleSessionWrites([
    SecureStore.deleteItemAsync(OWNER_KEY),
    SecureStore.deleteItemAsync(CURSORS_KEY),
    SecureStore.deleteItemAsync(LAST_SYNC_KEY),
    unregisterBackgroundHealthSync().catch(() => {}),
  ]);
}

export async function getLastHealthSync() {
  return SecureStore.getItemAsync(LAST_SYNC_KEY);
}

export function syncHealth(userId: string | number): Promise<HealthSyncResult> {
  assertOperationalAccess();
  const version = sessions.version();
  const epoch = connectionEpoch;
  if (connecting) return Promise.reject(new Error('A ligação de saúde está a ser confirmada. Aguarde.'));
  if (running?.userId === String(userId) && running.version === version && running.epoch === epoch) return running.promise;
  const promise = performSync(userId, version, epoch).finally(() => { if (running?.promise === promise) running = null; });
  running = { userId: String(userId), version, epoch, promise };
  return promise;
}

async function performSync(userId: string | number, version: number, epoch: number): Promise<HealthSyncResult> {
  await requireHealthSession(userId, version);
  assertConnection(version, epoch);
  const connection = await getHealthConnection(userId);
  assertConnection(version, epoch);
  if (!connection) throw new Error('Volte a ligar o serviço de saúde e escolha explicitamente o país dos consentimentos.');
  const scope = readingScope(connection.country, connection.consent_language);
  // A retained connection is not consent. Check current authority before the OS
  // read, including zero-record syncs, and let the server recheck every batch.
  await requireReadingConsent(scopedApi(version), scope, true, () => assertConnection(version, epoch));
  const rawCursors = await SecureStore.getItemAsync(CURSORS_KEY);
  assertConnection(version, epoch);
  const cursors: HealthCursors = rawCursors ? JSON.parse(rawCursors) : {};
  const result = await platformHealth.readChanges(cursors);
  assertConnection(version, epoch);

  const response = { imported: 0, updated: 0, skipped: 0 };
  for (let offset = 0; offset < result.records.length; offset += 500) {
    assertConnection(version, epoch);
    const config: AxiosRequestConfig & { _sessionVersion: number } = { _sessionVersion: version };
    const { data } = await api.post('/api/v1/readings/sync', {
      ...scope,
      records: result.records.slice(offset, offset + 500),
    }, config);
    assertConnection(version, epoch);
    response.imported += data.imported;
    response.updated += data.updated;
    response.skipped += data.skipped;
  }

  const lastSync = new Date().toISOString();
  await sessions.commit(version, async () => {
    assertConnection(version, epoch);
    await settleSessionWrites([
      SecureStore.setItemAsync(CURSORS_KEY, JSON.stringify(result.cursors)),
      SecureStore.setItemAsync(LAST_SYNC_KEY, lastSync),
    ]);
  });
  return { ...response, lastSync };
}

export async function subscribeToHealthChanges(onChange: () => void) {
  assertOperationalAccess();
  const version = sessions.version();
  const unsubscribe = await platformHealth.subscribe(() => { if (sessions.current(version)) onChange(); });
  if (!sessions.current(version)) { unsubscribe(); return () => {}; }
  return unsubscribe;
}

export function healthPlatformName() {
  return platformHealth.displayName;
}

export function openHealthSettings() {
  assertOperationalAccess();
  platformHealth.openSettings();
}
