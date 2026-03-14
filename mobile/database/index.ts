/**
 * Local data — Legend State store (replaces SQLite).
 * Standard import for screens: use `@/database` for getFarmers, getFarms, createOrUpdate*, etc.
 * Re-exports from @/store/database.
 */
export {
  getFarmers,
  getFarms,
  getAllFarms,
  getPlannedSchedules,
  getAllSchedulesForOfficer,
  getVisitsForOfficer,
  getAllVisits,
  getScheduleIdsWithRecordedVisits,
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
  type VisitRow,
  type SyncQueueRow,
} from '@/store/database';
