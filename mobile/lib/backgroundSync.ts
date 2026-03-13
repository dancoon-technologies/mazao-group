/**
 * Background sync: run syncWithServer when the app is in background so offline
 * data is pushed without the user opening the app. Uses expo-background-task
 * (BGTaskScheduler on iOS, WorkManager on Android).
 * Task must be defined in global scope; register when user is authenticated.
 */

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncWithServer } from '@/lib/syncWithServer';
import { logger } from '@/lib/logger';

export const BACKGROUND_SYNC_TASK = 'mazao-background-sync';

/** Minimum interval in minutes between background sync runs (platform may run less often). */
const MINIMUM_INTERVAL_MINUTES = 15;

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await syncWithServer();
    if (result.success) {
      logger.info('Background sync: completed successfully');
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    logger.warn('Background sync: failed', result.error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  } catch (e) {
    logger.warn('Background sync: error', e instanceof Error ? e.message : e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSyncTask(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      logger.warn('Background sync: not available (restricted)');
      return;
    }
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: MINIMUM_INTERVAL_MINUTES,
    });
    logger.info('Background sync: registered');
  } catch (e) {
    logger.warn('Background sync: register failed', e instanceof Error ? e.message : e);
  }
}

export async function unregisterBackgroundSyncTask(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    logger.info('Background sync: unregistered');
  } catch {
    // ignore
  }
}
