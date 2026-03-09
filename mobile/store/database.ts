/**
 * Database API — reads/writes Legend State store. Same async API as former SQLite layer.
 */
import { appState$ } from './observable';
import type { FarmerRow, FarmRow, ScheduleRow, SyncQueueRow, VisitRow } from './types';

export type { FarmerRow, FarmRow, ScheduleRow, VisitRow, SyncQueueRow } from './types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function upsertById<T extends { id: string }>(arr: T[], item: T): T[] {
  const next = [...arr];
  const i = next.findIndex((x) => x.id === item.id);
  if (i >= 0) next[i] = item;
  else next.push(item);
  return next;
}

export async function getFarmers(): Promise<FarmerRow[]> {
  const list = appState$.farmers.get() ?? [];
  return [...list].sort((a, b) => (a.display_name || a.first_name).localeCompare(b.display_name || b.first_name));
}

export async function getFarms(farmerId: string): Promise<FarmRow[]> {
  const list = appState$.farms.get() ?? [];
  return list.filter((f) => f.farmer_id === farmerId).sort((a, b) => a.village.localeCompare(b.village));
}

export async function getAllFarms(): Promise<FarmRow[]> {
  const list = appState$.farms.get() ?? [];
  return [...list].sort((a, b) => a.farmer_id.localeCompare(b.farmer_id) || a.village.localeCompare(b.village));
}

export async function getPlannedSchedules(
  userId: string,
  startTs: number,
  endTs: number
): Promise<ScheduleRow[]> {
  const list = appState$.schedules.get() ?? [];
  return list
    .filter(
      (s) =>
        s.officer === userId &&
        s.is_deleted === 0 &&
        s.scheduled_date >= startTs &&
        s.scheduled_date <= endTs
    )
    .sort((a, b) => a.scheduled_date - b.scheduled_date);
}

export async function getAllSchedulesForOfficer(officerId: string): Promise<ScheduleRow[]> {
  const list = appState$.schedules.get() ?? [];
  return list
    .filter((s) => s.officer === officerId && s.is_deleted === 0)
    .sort((a, b) => b.scheduled_date - a.scheduled_date);
}

export async function getVisitsForOfficer(officerId: string): Promise<VisitRow[]> {
  const list = appState$.visits.get() ?? [];
  return list
    .filter((v) => v.officer === officerId && v.is_deleted === 0)
    .sort((a, b) => b.created_at - a.created_at);
}

export async function getScheduleIdsWithRecordedVisits(officerId: string): Promise<Set<string>> {
  const list = appState$.visits.get() ?? [];
  const set = new Set<string>();
  for (const v of list) {
    if (v.officer === officerId && v.is_deleted === 0 && v.schedule_id) set.add(v.schedule_id);
  }
  return set;
}

export async function getPendingSyncQueue(): Promise<SyncQueueRow[]> {
  const list = appState$.syncQueue.get() ?? [];
  return list.filter((q) => q.status === 'pending').sort((a, b) => a.timestamp - b.timestamp);
}

export async function enqueueSyncItem(
  entity: string,
  operation: string,
  payload: Record<string, unknown>
): Promise<void> {
  const id = generateId();
  const row: SyncQueueRow = {
    id,
    operation,
    entity,
    payload: JSON.stringify(payload),
    status: 'pending',
    timestamp: Date.now(),
  };
  appState$.syncQueue.set((prev) => [...(prev ?? []), row]);
}

export async function markSyncItemSynced(id: string): Promise<void> {
  appState$.syncQueue.set((prev) =>
    (prev ?? []).map((q) => (q.id === id ? { ...q, status: 'synced' as const } : q))
  );
}

export async function getPendingSyncCount(): Promise<number> {
  const list = appState$.syncQueue.get() ?? [];
  return list.filter((q) => q.status === 'pending').length;
}

function toVisitRow(data: Record<string, unknown>): VisitRow {
  return {
    id: String(data.id),
    officer: String(data.officer ?? ''),
    farmer: String(data.farmer ?? ''),
    farm: data.farm != null ? String(data.farm) : null,
    schedule_id: data.schedule_id != null ? String(data.schedule_id) : null,
    latitude: Number(data.latitude) || 0,
    longitude: Number(data.longitude) || 0,
    photo_uri: data.photo_uri != null ? String(data.photo_uri) : null,
    notes: data.notes != null ? String(data.notes) : null,
    activity_type: data.activity_type != null ? String(data.activity_type) : null,
    verification_status: data.verification_status != null ? String(data.verification_status) : null,
    created_at: Number(data.created_at) || 0,
    updated_at: Number(data.updated_at) || 0,
    is_deleted: data.is_deleted ? 1 : 0,
  };
}

function toScheduleRow(data: Record<string, unknown>): ScheduleRow {
  return {
    id: String(data.id),
    officer: String(data.officer ?? ''),
    farmer: data.farmer != null ? String(data.farmer) : null,
    farm: data.farm != null ? String(data.farm) : null,
    farm_display_name: data.farm_display_name != null ? String(data.farm_display_name) : null,
    scheduled_date: Number(data.scheduled_date) || 0,
    notes: data.notes != null ? String(data.notes) : null,
    status: String(data.status ?? 'proposed'),
    created_by: data.created_by != null ? String(data.created_by) : null,
    approved_by: data.approved_by != null ? String(data.approved_by) : null,
    updated_at: Number(data.updated_at) || 0,
    is_deleted: data.is_deleted ? 1 : 0,
  };
}

function toFarmerRow(data: Record<string, unknown>): FarmerRow {
  return {
    id: String(data.id),
    first_name: String(data.first_name ?? ''),
    middle_name: data.middle_name != null ? String(data.middle_name) : null,
    last_name: String(data.last_name ?? ''),
    display_name: data.display_name != null ? String(data.display_name) : null,
    phone: data.phone != null ? String(data.phone) : null,
    latitude: data.latitude != null ? String(data.latitude) : null,
    longitude: data.longitude != null ? String(data.longitude) : null,
    crop_type: data.crop_type != null ? String(data.crop_type) : null,
    assigned_officer: data.assigned_officer != null ? String(data.assigned_officer) : null,
    created_at: Number(data.created_at) ?? 0,
  };
}

function toFarmRow(data: Record<string, unknown>): FarmRow {
  return {
    id: String(data.id),
    farmer_id: String(data.farmer_id ?? ''),
    village: String(data.village ?? ''),
    latitude: Number(data.latitude) || 0,
    longitude: Number(data.longitude) || 0,
    plot_size: data.plot_size != null ? String(data.plot_size) : null,
    crop_type: data.crop_type != null ? String(data.crop_type) : null,
    region_id: data.region_id != null ? Number(data.region_id) : null,
    county_id: data.county_id != null ? Number(data.county_id) : null,
    sub_county_id: data.sub_county_id != null ? Number(data.sub_county_id) : null,
    region: data.region != null ? String(data.region) : null,
    county: data.county != null ? String(data.county) : null,
    sub_county: data.sub_county != null ? String(data.sub_county) : null,
    created_at: Number(data.created_at) ?? 0,
  };
}

export async function createOrUpdateVisit(data: Record<string, unknown>): Promise<void> {
  const row = toVisitRow(data);
  appState$.visits.set((prev) => upsertById(prev ?? [], row));
}

export async function createOrUpdateSchedule(data: Record<string, unknown>): Promise<void> {
  const row = toScheduleRow(data);
  appState$.schedules.set((prev) => upsertById(prev ?? [], row));
}

export async function createOrUpdateFarmer(data: Record<string, unknown>): Promise<void> {
  const row = toFarmerRow(data);
  appState$.farmers.set((prev) => upsertById(prev ?? [], row));
}

export async function createOrUpdateFarm(data: Record<string, unknown>): Promise<void> {
  const row = toFarmRow(data);
  appState$.farms.set((prev) => upsertById(prev ?? [], row));
}
