import * as SecureStore from 'expo-secure-store';
import api from '../services/api';
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
  if (!(await platformHealth.isAvailable())) return false;
  const granted = await platformHealth.requestAuthorization();
  if (!granted) return false;
  await SecureStore.setItemAsync(OWNER_KEY, String(userId));
  await SecureStore.deleteItemAsync(CURSORS_KEY);
  await registerBackgroundHealthSync().catch(() => {});
  return true;
}

export async function disconnectHealth() {
  await Promise.all([
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
  if (!(await isHealthConnected(userId))) {
    throw new Error('health_not_connected');
  }
  const rawCursors = await SecureStore.getItemAsync(CURSORS_KEY);
  const cursors: HealthCursors = rawCursors ? JSON.parse(rawCursors) : {};
  const result = await platformHealth.readChanges(cursors);

  const response = { imported: 0, updated: 0, skipped: 0 };
  for (let offset = 0; offset < result.records.length; offset += 500) {
    const { data } = await api.post('/api/v1/readings/sync', {
      records: result.records.slice(offset, offset + 500),
    });
    response.imported += data.imported;
    response.updated += data.updated;
    response.skipped += data.skipped;
  }

  const lastSync = new Date().toISOString();
  await Promise.all([
    SecureStore.setItemAsync(CURSORS_KEY, JSON.stringify(result.cursors)),
    SecureStore.setItemAsync(LAST_SYNC_KEY, lastSync),
  ]);
  return { ...response, lastSync };
}

export async function subscribeToHealthChanges(onChange: () => void) {
  return platformHealth.subscribe(onChange);
}

export function healthPlatformName() {
  return platformHealth.displayName;
}

export function openHealthSettings() {
  platformHealth.openSettings();
}
