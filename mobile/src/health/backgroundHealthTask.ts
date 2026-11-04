import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { HEALTH_BACKGROUND_TASK } from './backgroundScheduler';
import { getHealthConnectionOwner, syncHealth } from './healthSync';
import { runBackgroundHealthSync } from './backgroundTaskPolicy';

TaskManager.defineTask(HEALTH_BACKGROUND_TASK, async () => {
  const result = await runBackgroundHealthSync(getHealthConnectionOwner, syncHealth);
  return result === 'success'
    ? BackgroundTask.BackgroundTaskResult.Success
    : BackgroundTask.BackgroundTaskResult.Failed;
});
