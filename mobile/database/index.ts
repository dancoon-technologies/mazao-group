/**
 * Local database — uses expo-sqlite (Expo-supported).
 * Re-exports from sqlite for convenience.
 */

export {
  getDb,
  getFarmers,
  getFarms,
  getPlannedSchedules,
  getPendingSyncQueue,
  enqueueSyncItem,
  markSyncItemSynced,
  getPendingSyncCount,
  createOrUpdateVisit,
  createOrUpdateSchedule,
  createOrUpdateFarmer,
  createOrUpdateFarm,
  type FarmerRow,
  type FarmRow,
  type ScheduleRow,
  type SyncQueueRow,
} from './sqlite'
