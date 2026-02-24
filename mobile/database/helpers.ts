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

  await database.action(async () => {
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
