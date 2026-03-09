/**
 * Local data — Legend State store (replaces SQLite).
 * Re-exports from store for compatibility.
 */
export {
  getFarmers,
  getFarms,
  getAllFarms,
  getPlannedSchedules,
  getAllSchedulesForOfficer,
  getVisitsForOfficer,
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
