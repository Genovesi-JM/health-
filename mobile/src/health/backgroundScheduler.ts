import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

export const HEALTH_BACKGROUND_TASK = 'kaya-health-measurement-sync';

export async function registerBackgroundHealthSync() {
  if (!(await TaskManager.isAvailableAsync())) return;
  if (await TaskManager.isTaskRegisteredAsync(HEALTH_BACKGROUND_TASK)) return;
  await BackgroundFetch.registerTaskAsync(HEALTH_BACKGROUND_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function unregisterBackgroundHealthSync() {
  if (await TaskManager.isTaskRegisteredAsync(HEALTH_BACKGROUND_TASK)) {
    await BackgroundFetch.unregisterTaskAsync(HEALTH_BACKGROUND_TASK);
  }
}
