import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { HEALTH_BACKGROUND_TASK } from './backgroundScheduler';
import { getHealthConnectionOwner, syncHealth } from './healthSync';

TaskManager.defineTask(HEALTH_BACKGROUND_TASK, async () => {
  const owner = await getHealthConnectionOwner();
  if (!owner) return BackgroundFetch.BackgroundFetchResult.NoData;
  try {
    const result = await syncHealth(owner);
    return result.imported || result.updated
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
