import * as SecureStore from 'expo-secure-store';
import { assertOperationalAccess } from '../phase1/policy';
import api, { sessions } from '../services/api';
import type { AxiosRequestConfig } from 'axios';
import { settleSessionWrites } from '../services/sessionCoordinator';
import platformHealth from './platformHealth';
import type { HealthCursors } from './types';
import {
  registerBackgroundHealthSync,
  unregisterBackgroundHealthSync,
} from './backgroundScheduler';

const OWNER_KEY = 'kaya_health_connection_owner';
const CURSORS_KEY = 'kaya_health_sync_cursors';
const LAST_SYNC_KEY = 'kaya_health_last_sync';

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
  return (await SecureStore.getItemAsync(OWNER_KEY)) === String(userId);
}

export async function getHealthConnectionOwner() {
  return SecureStore.getItemAsync(OWNER_KEY);
}

export async function connectHealth(userId: string | number) {
  assertOperationalAccess();
  const version = sessions.version();
  await requireHealthSession(userId, version);
  if (!(await platformHealth.isAvailable())) return false;
  sessions.assertCurrent(version);
  const granted = await platformHealth.requestAuthorization();
  sessions.assertCurrent(version);
  if (!granted) return false;
  await sessions.commit(version, async () => {
    await SecureStore.setItemAsync(OWNER_KEY, String(userId));
    await SecureStore.deleteItemAsync(CURSORS_KEY);
    await SecureStore.deleteItemAsync(LAST_SYNC_KEY);
    await registerBackgroundHealthSync().catch(() => {});
  });
  return true;
}

export async function disconnectHealth() {
  await sessions.commit(sessions.version(), clearHealthConnection);
}

/** Auth logout invokes this inside its already serialized secure-storage cleanup. */
export async function clearHealthConnection() {
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

export async function syncHealth(userId: string | number): Promise<HealthSyncResult> {
  assertOperationalAccess();
  const version = sessions.version();
  await requireHealthSession(userId, version);
  if (!(await isHealthConnected(userId))) {
    throw new Error('health_not_connected');
  }
  const rawCursors = await SecureStore.getItemAsync(CURSORS_KEY);
  sessions.assertCurrent(version);
  const cursors: HealthCursors = rawCursors ? JSON.parse(rawCursors) : {};
  const result = await platformHealth.readChanges(cursors);
  sessions.assertCurrent(version);

  const response = { imported: 0, updated: 0, skipped: 0 };
  for (let offset = 0; offset < result.records.length; offset += 500) {
    sessions.assertCurrent(version);
    const config: AxiosRequestConfig & { _sessionVersion: number } = { _sessionVersion: version };
    const { data } = await api.post('/api/v1/readings/sync', {
      records: result.records.slice(offset, offset + 500),
    }, config);
    sessions.assertCurrent(version);
    response.imported += data.imported;
    response.updated += data.updated;
    response.skipped += data.skipped;
  }

  const lastSync = new Date().toISOString();
  await sessions.commit(version, async () => {
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
