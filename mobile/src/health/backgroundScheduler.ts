import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { assertOperationalAccess } from '../phase1/policy';
import { HEALTH_BACKGROUND_INTERVAL_MINUTES } from './backgroundTaskPolicy';

export const HEALTH_BACKGROUND_TASK = 'kaya-health-measurement-sync';

export async function registerBackgroundHealthSync() {
  assertOperationalAccess();
  if (!(await TaskManager.isAvailableAsync())) return;
  if (await TaskManager.isTaskRegisteredAsync(HEALTH_BACKGROUND_TASK)) return;
  await BackgroundTask.registerTaskAsync(HEALTH_BACKGROUND_TASK, {
    minimumInterval: HEALTH_BACKGROUND_INTERVAL_MINUTES,
  });
}

export async function unregisterBackgroundHealthSync() {
  if (await TaskManager.isTaskRegisteredAsync(HEALTH_BACKGROUND_TASK)) {
    await BackgroundTask.unregisterTaskAsync(HEALTH_BACKGROUND_TASK);
  }
}
