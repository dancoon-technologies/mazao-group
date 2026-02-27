import { Model } from '@nozbe/watermelondb'
import { database } from './index'

function isoToTimestamp(iso: string | null | undefined): number | null {
  if (iso == null) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

function dateStringToTimestamp(dateStr: string | null | undefined): number {
  if (dateStr == null) return 0
  const t = new Date(dateStr + 'T00:00:00Z').getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Normalize server visit to local schema (ids, timestamps) */
export function normalizeServerVisit(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    officer: record.officer ?? '',
    farmer: record.farmer ?? '',
    farm: record.farm ?? null,
    latitude: Number(record.latitude) || 0,
    longitude: Number(record.longitude) || 0,
    photo_uri: record.photo ? String(record.photo) : null,
    notes: record.notes ?? null,
    activity_type: record.activity_type ?? null,
    verification_status: record.verification_status ?? null,
    created_at: isoToTimestamp(record.created_at as string) ?? Date.now(),
    updated_at: isoToTimestamp(record.updated_at as string) ?? Date.now(),
    is_deleted: Boolean(record.is_deleted),
  }
}

/** Normalize server schedule to local schema */
export function normalizeServerSchedule(record: Record<string, unknown>): Record<string, unknown> {
  const scheduledDate = record.scheduled_date as string | undefined
  return {
    id: record.id,
    officer: record.officer ?? '',
    farmer: record.farmer ?? null,
    scheduled_date: dateStringToTimestamp(scheduledDate),
    notes: record.notes ?? null,
    status: record.status ?? 'proposed',
    created_by: record.created_by ?? null,
    approved_by: record.approved_by ?? null,
    updated_at: isoToTimestamp(record.updated_at as string) ?? Date.now(),
    is_deleted: Boolean(record.is_deleted),
  }
}

/** Normalize server farmer to local schema */
export function normalizeServerFarmer(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    first_name: record.first_name ?? '',
    middle_name: record.middle_name ?? null,
    last_name: record.last_name ?? '',
    display_name: record.display_name ?? null,
    phone: record.phone ?? null,
    latitude: record.latitude != null ? String(record.latitude) : null,
    longitude: record.longitude != null ? String(record.longitude) : null,
    crop_type: record.crop_type ?? null,
    assigned_officer: record.assigned_officer ?? null,
    created_at: isoToTimestamp(record.created_at as string) ?? 0,
  }
}

/** Normalize server farm to local schema */
export function normalizeServerFarm(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    farmer_id: record.farmer ?? '',
    village: record.village ?? '',
    latitude: Number(record.latitude) || 0,
    longitude: Number(record.longitude) || 0,
    plot_size: record.plot_size ?? null,
    crop_type: record.crop_type ?? null,
    region_id: record.region_id != null ? Number(record.region_id) : null,
    county_id: record.county_id != null ? Number(record.county_id) : null,
    sub_county_id: record.sub_county_id != null ? Number(record.sub_county_id) : null,
    region: record.region ?? null,
    county: record.county ?? null,
    sub_county: record.sub_county ?? null,
    created_at: isoToTimestamp(record.created_at as string) ?? 0,
  }
}

/**
 * createOrUpdate - inserts or updates a record in WatermelonDB
 * @param tableName - 'visits' | 'schedules'
 * @param data - record payload (normalized for local schema)
 * @param ModelClass - Visit or Schedule model class
 */
export async function createOrUpdate<T extends Model>(
  tableName: string,
  data: Record<string, unknown>,
  ModelClass: new (...args: unknown[]) => T
) {
  const collection = database.get(tableName)
  const id = data.id as string
  const existing = await collection.find(id).catch(() => null)

  await database.write(async () => {
    if (existing) {
      await existing.update((record) => {
        Object.entries(data).forEach(([key, value]) => {
          ;(record as unknown as Record<string, unknown>)[key] = value
        })
      })
    } else {
      await collection.create((record) => {
        Object.entries(data).forEach(([key, value]) => {
          ;(record as unknown as Record<string, unknown>)[key] = value
        })
      })
    }
  })
}
