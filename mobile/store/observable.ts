/**
 * Legend State store — split by key to avoid single large blob and stay under AsyncStorage limits.
 * Each slice has its own persist key.
 */

import { observable } from '@legendapp/state';
import {
  configureObservablePersistence,
  persistObservable,
} from '@legendapp/state/persist';
import { ObservablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Farm, LocationData, OptionsResponse } from '@/lib/api';
import type { FarmerRow, FarmRow, ScheduleRow, SyncQueueRow, VisitRow } from './types';

configureObservablePersistence({
  pluginLocal: ObservablePersistAsyncStorage,
  localOptions: {
    asyncStorage: {
      AsyncStorage,
    },
  },
});

/** App meta (last sync time, cached dashboard stats, cached options for offline). */
export const appMeta$ = observable<{
  lastSyncAt: string | null;
  cachedStats: { visits_today: number; visits_this_month: number } | null;
  cachedOptions: OptionsResponse | null;
}>({
  lastSyncAt: null,
  cachedStats: null,
  cachedOptions: null,
});
persistObservable(appMeta$, { local: 'mazao_meta' });

/** Cached Kenya locations (regions, counties, sub_counties) for offline add-farmer/add-farm. */
export const locationsCache$ = observable<LocationData | null>(null);
persistObservable(locationsCache$, { local: 'mazao_locations_cache' });

/** Farmers list. */
export const farmers$ = observable<FarmerRow[]>([]);
persistObservable(farmers$, { local: 'mazao_farmers' });

/** Farms list. */
export const farms$ = observable<FarmRow[]>([]);
persistObservable(farms$, { local: 'mazao_farms' });

/** Schedules list (capped when writing). */
export const schedules$ = observable<ScheduleRow[]>([]);
persistObservable(schedules$, { local: 'mazao_schedules' });

/** Visits list (capped when writing). */
export const visits$ = observable<VisitRow[]>([]);
persistObservable(visits$, { local: 'mazao_visits' });

/** Pending sync queue. */
export const syncQueue$ = observable<SyncQueueRow[]>([]);
persistObservable(syncQueue$, { local: 'mazao_sync_queue' });

/** Last farm added via Add Farm (online). Detail screen merges it and clears. Not persisted. */
export const lastAddedFarm$ = observable<{ farmerId: string; farm: Farm } | null>(null);

/** Rehydration: persist loads from AsyncStorage asynchronously. Avoid critical reads before first paint if you need guaranteed hydrated data; otherwise reads return last in-memory value (may be []). */
