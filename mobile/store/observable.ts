/**
 * Legend State store — single source of truth (replaces SQLite).
 * Persisted to AsyncStorage for offline-first.
 */

import { observable } from '@legendapp/state';
import {
  configureObservablePersistence,
  persistObservable,
} from '@legendapp/state/persist';
import { ObservablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FarmerRow, FarmRow, ScheduleRow, SyncQueueRow, VisitRow } from './types';

configureObservablePersistence({
  pluginLocal: ObservablePersistAsyncStorage,
  localOptions: {
    asyncStorage: {
      AsyncStorage,
    },
  },
});

/** Full app store (farmers, farms, schedules, visits, sync queue, app meta). */
export const appState$ = observable({
  lastSyncAt: null as string | null,
  cachedStats: null as { visits_today: number; visits_this_month: number } | null,
  farmers: [] as FarmerRow[],
  farms: [] as FarmRow[],
  schedules: [] as ScheduleRow[],
  visits: [] as VisitRow[],
  syncQueue: [] as SyncQueueRow[],
});

persistObservable(appState$, {
  local: 'mazao_store',
});
