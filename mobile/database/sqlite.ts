/**
 * Local SQLite storage using expo-sqlite (Expo-supported, no New Arch issues).
 * Replaces WatermelonDB for visits, schedules, sync_queue, farmers, farms.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'mazao.db';
let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initSchema(db);
  return db;
}

async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL,
      entity TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY NOT NULL,
      officer TEXT NOT NULL,
      farmer TEXT NOT NULL,
      farm TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      photo_uri TEXT,
      notes TEXT,
      activity_type TEXT,
      verification_status TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY NOT NULL,
      officer TEXT NOT NULL,
      farmer TEXT,
      scheduled_date INTEGER NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      created_by TEXT,
      approved_by TEXT,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS farmers (
      id TEXT PRIMARY KEY NOT NULL,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      display_name TEXT,
      phone TEXT,
      latitude TEXT,
      longitude TEXT,
      crop_type TEXT,
      assigned_officer TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY NOT NULL,
      farmer_id TEXT NOT NULL,
      village TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      plot_size TEXT,
      crop_type TEXT,
      region_id INTEGER,
      county_id INTEGER,
      sub_county_id INTEGER,
      region TEXT,
      county TEXT,
      sub_county TEXT,
      created_at INTEGER NOT NULL
    );
  `);
}

// --- Farmers ---

export interface FarmerRow {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  display_name: string | null;
  phone: string | null;
  latitude: string | null;
  longitude: string | null;
  crop_type: string | null;
  assigned_officer: string | null;
  created_at: number;
}

export async function getFarmers(): Promise<FarmerRow[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<FarmerRow>('SELECT * FROM farmers ORDER BY display_name, first_name');
  return rows ?? [];
}

// --- Farms ---

export interface FarmRow {
  id: string;
  farmer_id: string;
  village: string;
  latitude: number;
  longitude: number;
  plot_size: string | null;
  crop_type: string | null;
  region_id: number | null;
  county_id: number | null;
  sub_county_id: number | null;
  region: string | null;
  county: string | null;
  sub_county: string | null;
  created_at: number;
}

export async function getFarms(farmerId: string): Promise<FarmRow[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<FarmRow>('SELECT * FROM farms WHERE farmer_id = ? ORDER BY village', farmerId);
  return rows ?? [];
}

/** All farms (for offline farmers tab). */
export async function getAllFarms(): Promise<FarmRow[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<FarmRow>('SELECT * FROM farms ORDER BY farmer_id, village');
  return rows ?? [];
}

// --- Schedules (for planned visits) ---

export interface ScheduleRow {
  id: string;
  officer: string;
  farmer: string | null;
  scheduled_date: number;
  notes: string | null;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  updated_at: number;
  is_deleted: number;
}

export async function getPlannedSchedules(userId: string, startTs: number, endTs: number): Promise<ScheduleRow[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<ScheduleRow>(
    'SELECT * FROM schedules WHERE officer = ? AND is_deleted = 0 AND scheduled_date >= ? AND scheduled_date <= ? ORDER BY scheduled_date',
    userId,
    startTs,
    endTs
  );
  return rows ?? [];
}

/** All schedules for an officer (for offline visits tab list). */
export async function getAllSchedulesForOfficer(officerId: string): Promise<ScheduleRow[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<ScheduleRow>(
    'SELECT * FROM schedules WHERE officer = ? AND is_deleted = 0 ORDER BY scheduled_date DESC',
    officerId
  );
  return rows ?? [];
}

// --- Visits (for offline history list) ---

export interface VisitRow {
  id: string;
  officer: string;
  farmer: string;
  farm: string | null;
  latitude: number;
  longitude: number;
  photo_uri: string | null;
  notes: string | null;
  activity_type: string | null;
  verification_status: string | null;
  created_at: number;
  updated_at: number;
  is_deleted: number;
}

/** All visits for an officer (for offline visits tab history). */
export async function getVisitsForOfficer(officerId: string): Promise<VisitRow[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<VisitRow>(
    'SELECT * FROM visits WHERE officer = ? AND is_deleted = 0 ORDER BY created_at DESC',
    officerId
  );
  return rows ?? [];
}

// --- Sync queue ---

export interface SyncQueueRow {
  id: string;
  operation: string;
  entity: string;
  payload: string;
  status: string;
  timestamp: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function getPendingSyncQueue(): Promise<SyncQueueRow[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<SyncQueueRow>(
    'SELECT * FROM sync_queue WHERE status = ? ORDER BY timestamp',
    'pending'
  );
  return rows ?? [];
}

export async function enqueueSyncItem(entity: string, operation: string, payload: Record<string, unknown>): Promise<void> {
  const database = await getDb();
  const id = generateId();
  await database.runAsync(
    'INSERT INTO sync_queue (id, operation, entity, payload, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    operation,
    entity,
    JSON.stringify(payload),
    'pending',
    Date.now()
  );
}

export async function markSyncItemSynced(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('UPDATE sync_queue SET status = ? WHERE id = ?', 'synced', id);
}

export async function getPendingSyncCount(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_queue WHERE status = ?', 'pending');
  return row?.count ?? 0;
}

// --- createOrUpdate for pull/sync ---

export async function createOrUpdateVisit(data: Record<string, unknown>): Promise<void> {
  const database = await getDb();
  const id = String(data.id);
  const officer = String(data.officer ?? '');
  const farmer = String(data.farmer ?? '');
  const farm = data.farm != null ? String(data.farm) : null;
  const latitude = Number(data.latitude) || 0;
  const longitude = Number(data.longitude) || 0;
  const photo_uri = data.photo_uri != null ? String(data.photo_uri) : null;
  const notes = data.notes != null ? String(data.notes) : null;
  const activity_type = data.activity_type != null ? String(data.activity_type) : null;
  const verification_status = data.verification_status != null ? String(data.verification_status) : null;
  const created_at = Number(data.created_at) || 0;
  const updated_at = Number(data.updated_at) || 0;
  const is_deleted = data.is_deleted ? 1 : 0;

  await database.runAsync(
    `INSERT INTO visits (id, officer, farmer, farm, latitude, longitude, photo_uri, notes, activity_type, verification_status, created_at, updated_at, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       officer=?, farmer=?, farm=?, latitude=?, longitude=?, photo_uri=?, notes=?, activity_type=?, verification_status=?,
       created_at=?, updated_at=?, is_deleted=?`,
    id, officer, farmer, farm, latitude, longitude, photo_uri, notes, activity_type, verification_status, created_at, updated_at, is_deleted,
    officer, farmer, farm, latitude, longitude, photo_uri, notes, activity_type, verification_status, created_at, updated_at, is_deleted
  );
}

export async function createOrUpdateSchedule(data: Record<string, unknown>): Promise<void> {
  const database = await getDb();
  const id = String(data.id);
  const officer = String(data.officer ?? '');
  const farmer = data.farmer != null ? String(data.farmer) : null;
  const scheduled_date = Number(data.scheduled_date) || 0;
  const notes = data.notes != null ? String(data.notes) : null;
  const status = String(data.status ?? 'proposed');
  const created_by = data.created_by != null ? String(data.created_by) : null;
  const approved_by = data.approved_by != null ? String(data.approved_by) : null;
  const updated_at = Number(data.updated_at) || 0;
  const is_deleted = data.is_deleted ? 1 : 0;

  await database.runAsync(
    `INSERT INTO schedules (id, officer, farmer, scheduled_date, notes, status, created_by, approved_by, updated_at, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       officer=?, farmer=?, scheduled_date=?, notes=?, status=?, created_by=?, approved_by=?, updated_at=?, is_deleted=?`,
    id, officer, farmer, scheduled_date, notes, status, created_by, approved_by, updated_at, is_deleted,
    officer, farmer, scheduled_date, notes, status, created_by, approved_by, updated_at, is_deleted
  );
}

export async function createOrUpdateFarmer(data: Record<string, unknown>): Promise<void> {
  const database = await getDb();
  const id = String(data.id);
  const first_name = String(data.first_name ?? '');
  const middle_name = data.middle_name != null ? String(data.middle_name) : null;
  const last_name = String(data.last_name ?? '');
  const display_name = data.display_name != null ? String(data.display_name) : null;
  const phone = data.phone != null ? String(data.phone) : null;
  const latitude = data.latitude != null ? String(data.latitude) : null;
  const longitude = data.longitude != null ? String(data.longitude) : null;
  const crop_type = data.crop_type != null ? String(data.crop_type) : null;
  const assigned_officer = data.assigned_officer != null ? String(data.assigned_officer) : null;
  const created_at = Number(data.created_at) ?? 0;

  await database.runAsync(
    `INSERT INTO farmers (id, first_name, middle_name, last_name, display_name, phone, latitude, longitude, crop_type, assigned_officer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       first_name=?, middle_name=?, last_name=?, display_name=?, phone=?, latitude=?, longitude=?, crop_type=?, assigned_officer=?, created_at=?`,
    id, first_name, middle_name, last_name, display_name, phone, latitude, longitude, crop_type, assigned_officer, created_at,
    first_name, middle_name, last_name, display_name, phone, latitude, longitude, crop_type, assigned_officer, created_at
  );
}

export async function createOrUpdateFarm(data: Record<string, unknown>): Promise<void> {
  const database = await getDb();
  const id = String(data.id);
  const farmer_id = String(data.farmer_id ?? '');
  const village = String(data.village ?? '');
  const latitude = Number(data.latitude) || 0;
  const longitude = Number(data.longitude) || 0;
  const plot_size = data.plot_size != null ? String(data.plot_size) : null;
  const crop_type = data.crop_type != null ? String(data.crop_type) : null;
  const region_id = data.region_id != null ? Number(data.region_id) : null;
  const county_id = data.county_id != null ? Number(data.county_id) : null;
  const sub_county_id = data.sub_county_id != null ? Number(data.sub_county_id) : null;
  const region = data.region != null ? String(data.region) : null;
  const county = data.county != null ? String(data.county) : null;
  const sub_county = data.sub_county != null ? String(data.sub_county) : null;
  const created_at = Number(data.created_at) ?? 0;

  await database.runAsync(
    `INSERT INTO farms (id, farmer_id, village, latitude, longitude, plot_size, crop_type, region_id, county_id, sub_county_id, region, county, sub_county, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       farmer_id=?, village=?, latitude=?, longitude=?, plot_size=?, crop_type=?, region_id=?, county_id=?, sub_county_id=?, region=?, county=?, sub_county=?, created_at=?`,
    id, farmer_id, village, latitude, longitude, plot_size, crop_type, region_id, county_id, sub_county_id, region, county, sub_county, created_at,
    farmer_id, village, latitude, longitude, plot_size, crop_type, region_id, county_id, sub_county_id, region, county, sub_county, created_at
  );
}
