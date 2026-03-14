import * as SecureStore from 'expo-secure-store'
import { API_BASE, LAST_SYNC_KEY, STORAGE_KEYS, SYNC_PULL_PATH } from '@/constants/config'
import { refreshDeviceClockOffset } from '@/lib/deviceClockSync'
import {
  createOrUpdateFarm,
  createOrUpdateFarmer,
  createOrUpdateSchedulesBatch,
  createOrUpdateVisitsBatch,
  getPendingSyncCount as getPendingSyncCountDb,
  getPendingSyncQueue,
  markSyncItemSynced,
  enqueueSyncItem,
} from '@/store/database'
import {
  normalizeServerFarm,
  normalizeServerFarmer,
  normalizeServerSchedule,
  normalizeServerVisit,
} from '@/store/helpers'
import { api } from '@/lib/api'
import { logger } from '@/lib/logger'
import { appMeta$ } from '@/store/observable'

async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN)
}

async function getLastSync(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_SYNC_KEY)
}

async function setLastSync(iso: string): Promise<void> {
  await SecureStore.setItemAsync(LAST_SYNC_KEY, iso)
}

/** Push pending sync queue items to the server. Fail fast: on first item error returns immediately (remaining items stay pending for next sync). */
async function pushQueue(accessToken: string): Promise<{ ok: boolean; error?: string; pushedIds: string[] }> {
  await refreshDeviceClockOffset(accessToken)
  const toSync = await getPendingSyncQueue()
  const pushedIds: string[] = []

  const locationReportItems = toSync.filter((i) => i.entity === 'location_report')
  if (locationReportItems.length > 0) {
    try {
      const reports = locationReportItems.map((i) => JSON.parse(i.payload) as Record<string, unknown>)
      const res = await fetch(`${API_BASE}/tracking/reports/batch/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ reports }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string }
        return { ok: false, error: err.detail ?? 'Location reports upload failed', pushedIds }
      }
      locationReportItems.forEach((i) => pushedIds.push(i.id))
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Location reports upload failed', pushedIds }
    }
  }

  for (const item of toSync) {
    if (item.entity === 'location_report') continue
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>
      if (item.entity === 'visit') {
        if (!payload.schedule_id) {
          return { ok: false, error: 'Visits require a planned schedule. This visit cannot be synced.', pushedIds }
        }
        const form = new FormData()
        form.append('farmer_id', String(payload.farmer_id ?? payload.farmer))
        form.append('schedule_id', String(payload.schedule_id))
        if (payload.farm_id) form.append('farm_id', String(payload.farm_id))
        form.append('latitude', String(payload.latitude))
        form.append('longitude', String(payload.longitude))
        if (payload.notes) form.append('notes', String(payload.notes))
        form.append('activity_type', String(payload.activity_type ?? 'farm_to_farm_visits'))
        if (payload.crop_stage) form.append('crop_stage', String(payload.crop_stage))
        if (payload.germination_percent != null) form.append('germination_percent', String(payload.germination_percent))
        if (payload.survival_rate) form.append('survival_rate', String(payload.survival_rate))
        if (payload.pests_diseases) form.append('pests_diseases', String(payload.pests_diseases))
        if (payload.order_value != null) form.append('order_value', String(payload.order_value))
        if (payload.harvest_kgs != null) form.append('harvest_kgs', String(payload.harvest_kgs))
        if (payload.farmers_feedback) form.append('farmers_feedback', String(payload.farmers_feedback))
        if (payload.photo_taken_at) form.append('photo_taken_at', String(payload.photo_taken_at))
        if (payload.photo_device_info) form.append('photo_device_info', String(payload.photo_device_info))
        if (payload.photo_place_name) form.append('photo_place_name', String(payload.photo_place_name))
        const photoUri = payload.photo_uri as string | undefined
        if (photoUri) {
          form.append('photo', {
            uri: photoUri,
            type: 'image/jpeg',
            name: 'photo.jpg',
          } as unknown as Blob)
        }
        const res = await fetch(`${API_BASE}/visits/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return { ok: false, error: (err.detail || err.photo?.[0] || 'Visit upload failed') as string, pushedIds }
        }
        pushedIds.push(item.id)
      } else if (item.entity === 'schedule') {
        const res = await fetch(`${API_BASE}/schedules/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            ...(payload.officer ? { officer: payload.officer } : {}),
            farmer: payload.farmer || null,
            farm: payload.farm ?? null,
            scheduled_date: payload.scheduled_date,
            notes: payload.notes || '',
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return { ok: false, error: (err.detail || 'Schedule upload failed') as string, pushedIds }
        }
        pushedIds.push(item.id)
      } else if (item.entity === 'farmer_with_farm') {
        const farmerPayload = payload.farmer as Record<string, unknown>
        const farmPayload = payload.farm as Record<string, unknown>
        const farmerRes = await fetch(`${API_BASE}/farmers/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            first_name: farmerPayload.first_name,
            middle_name: farmerPayload.middle_name ?? undefined,
            last_name: farmerPayload.last_name,
            phone: farmerPayload.phone ?? undefined,
            crop_type: farmerPayload.crop_type ?? undefined,
            latitude: farmerPayload.latitude,
            longitude: farmerPayload.longitude,
          }),
        })
        if (!farmerRes.ok) {
          const err = await farmerRes.json().catch(() => ({}))
          const errObj = err as { detail?: string; first_name?: string[] };
          return { ok: false, error: (errObj.detail || errObj.first_name?.[0] || 'Farmer create failed') as string, pushedIds }
        }
        const farmerCreated = (await farmerRes.json()) as { id: string }
        const farmRes = await fetch(`${API_BASE}/farms/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            farmer_id: farmerCreated.id,
            region_id: farmPayload.region_id,
            county_id: farmPayload.county_id,
            sub_county_id: farmPayload.sub_county_id,
            village: farmPayload.village,
            latitude: farmPayload.latitude,
            longitude: farmPayload.longitude,
            plot_size: farmPayload.plot_size ?? undefined,
            crop_type: farmPayload.crop_type ?? undefined,
            device_latitude: farmPayload.device_latitude,
            device_longitude: farmPayload.device_longitude,
          }),
        })
        if (!farmRes.ok) {
          const err = await farmRes.json().catch(() => ({}))
          return { ok: false, error: (err.detail || 'Farm create failed') as string, pushedIds }
        }
      } else if (item.entity === 'farm') {
        const res = await fetch(`${API_BASE}/farms/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            farmer_id: payload.farmer_id,
            region_id: payload.region_id,
            county_id: payload.county_id,
            sub_county_id: payload.sub_county_id,
            village: payload.village,
            latitude: payload.latitude,
            longitude: payload.longitude,
            plot_size: payload.plot_size ?? undefined,
            crop_type: payload.crop_type ?? undefined,
            device_latitude: payload.device_latitude,
            device_longitude: payload.device_longitude,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return { ok: false, error: (err.detail || 'Farm create failed') as string, pushedIds }
        }
        pushedIds.push(item.id)
      }

      // Don't mark synced here; caller marks only after pull succeeds
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Sync queue item failed',
        pushedIds,
      }
    }
  }
  return { ok: true, pushedIds }
}

/** Pull visits and schedules from server and merge into local store (batch update). */
async function pullFromServer(accessToken: string): Promise<{ ok: boolean; error?: string; serverTime?: string }> {
  const lastSync = await getLastSync()
  const base = `${API_BASE}/${SYNC_PULL_PATH.replace(/^\//, '')}`
  const url = lastSync ? `${base}?last_sync=${encodeURIComponent(lastSync)}` : base
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    if (res.status === 401) return { ok: false, error: 'Unauthorized' }
    return { ok: false, error: `Pull failed: ${res.status}` }
  }
  const data = (await res.json()) as {
    visits?: Record<string, unknown>[]
    schedules?: Record<string, unknown>[]
    server_time?: string
  }
  const serverTime = data.server_time
  const visitsNorm = (data.visits ?? []).map((v) => normalizeServerVisit(v))
  const schedulesNorm = (data.schedules ?? []).map((s) => normalizeServerSchedule(s))
  await createOrUpdateVisitsBatch(visitsNorm)
  await createOrUpdateSchedulesBatch(schedulesNorm)
  if (serverTime) await setLastSync(serverTime)

  if (visitsNorm.length === 0 && schedulesNorm.length === 0) {
    try {
      const [apiVisits, apiSchedules] = await Promise.all([
        api.getVisits(),
        api.getSchedules(),
      ])
      const vNorm = (Array.isArray(apiVisits) ? apiVisits : []).map((v) =>
        normalizeServerVisit(v as unknown as Record<string, unknown>)
      )
      const sNorm = (Array.isArray(apiSchedules) ? apiSchedules : []).map((s) =>
        normalizeServerSchedule(s as unknown as Record<string, unknown>)
      )
      if (vNorm.length > 0 || sNorm.length > 0) {
        await createOrUpdateVisitsBatch(vNorm)
        await createOrUpdateSchedulesBatch(sNorm)
        logger.info('Sync fallback: merged visits=%s schedules=%s from list API', vNorm.length, sNorm.length)
      }
    } catch (e) {
      logger.warn('Sync fallback fetch failed', e instanceof Error ? e.message : e)
    }
  }
  return { ok: true, serverTime }
}

/** Pull farmers and farms from API and upsert into local store. Returns error message if failed. */
async function syncFarmersAndFarms(): Promise<string | undefined> {
  try {
    const [farmers, farms] = await Promise.all([api.getFarmers(), api.getFarms()])
    for (const f of farmers) {
      const normalized = normalizeServerFarmer(f as unknown as Record<string, unknown>)
      await createOrUpdateFarmer(normalized)
    }
    for (const f of farms) {
      const normalized = normalizeServerFarm(f as unknown as Record<string, unknown>)
      await createOrUpdateFarm(normalized)
    }
    logger.info(`syncFarmersAndFarms: upserted ${farmers.length} farmers, ${farms.length} farms`)
    return undefined
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Farmers/farms sync failed'
    logger.warn('syncFarmersAndFarms failed', msg)
    return msg
  }
}

let syncing = false

/**
 * Full sync: push pending queue (fail fast on first queue item error), then pull, then mark pushed
 * items synced, then sync farmers/farms. Only one sync runs at a time.
 * Returns { success, error?, warning? }. warning is set if farmers/farms sync failed but push+pull succeeded.
 */
export async function syncWithServer(): Promise<{ success: boolean; error?: string; warning?: string }> {
  if (syncing) return { success: false, error: 'Sync already in progress' }
  const accessToken = await getAccessToken()
  if (!accessToken) return { success: false, error: 'Not authenticated' }

  syncing = true
  try {
    const pushResult = await pushQueue(accessToken)
    if (!pushResult.ok) return { success: false, error: pushResult.error }

    const pullResult = await pullFromServer(accessToken)
    if (!pullResult.ok) return { success: false, error: pullResult.error }

    for (const id of pushResult.pushedIds ?? []) {
      await markSyncItemSynced(id)
    }

    const farmerFarmError: string | undefined = await syncFarmersAndFarms()
    appMeta$.lastSyncAt.set(new Date().toISOString())
    if (farmerFarmError) return { success: true, warning: farmerFarmError }
    return { success: true }
  } finally {
    syncing = false
  }
}


export { getLastSync, setLastSync }

/** Enqueue a visit for later sync (offline). Payload must include photo_uri (local file path). */
export async function enqueueVisit(payload: {
  farmer_id: string
  farm_id?: string | null
  schedule_id: string
  latitude: number
  longitude: number
  photo_uri: string
  photo_taken_at?: string
  photo_device_info?: string
  photo_place_name?: string
  notes?: string
  activity_type?: string
  crop_stage?: string
  germination_percent?: number | null
  survival_rate?: string
  pests_diseases?: string
  order_value?: number | null
  harvest_kgs?: number | null
  farmers_feedback?: string
}): Promise<void> {
  await enqueueSyncItem('visit', 'CREATE', payload)
}

/** Enqueue a schedule for later sync (offline). Include officer when assigner (admin/supervisor). */
export async function enqueueSchedule(payload: {
  officer?: string
  farmer?: string | null
  farm?: string | null
  scheduled_date: string
  notes?: string
}): Promise<void> {
  await enqueueSyncItem('schedule', 'CREATE', payload)
}

/** Enqueue farmer + farm for later sync (offline add-farmer). */
export async function enqueueFarmerWithFarm(payload: {
  farmer: {
    first_name: string
    middle_name?: string
    last_name: string
    phone?: string
    crop_type?: string
    latitude: number
    longitude: number
  }
  farm: {
    region_id: number
    county_id: number
    sub_county_id: number
    village: string
    latitude: number
    longitude: number
    plot_size?: string
    crop_type?: string
    device_latitude?: number
    device_longitude?: number
  }
}): Promise<void> {
  await enqueueSyncItem('farmer_with_farm', 'CREATE', payload)
}

/** Enqueue a farm for later sync (offline add-farm). */
export async function enqueueFarm(payload: {
  farmer_id: string
  region_id: number
  county_id: number
  sub_county_id: number
  village: string
  latitude: number
  longitude: number
  plot_size?: string
  crop_type?: string
  device_latitude?: number
  device_longitude?: number
}): Promise<void> {
  await enqueueSyncItem('farm', 'CREATE', payload)
}

/** Get count of pending sync items */
export async function getPendingSyncCount(): Promise<number> {
  return getPendingSyncCountDb()
}

/** Enqueue a location report for later sync (offline-first). Collected during working hours with battery and device info. */
export async function enqueueLocationReport(payload: {
  reported_at: string
  device_clock_offset_seconds?: number | null
  latitude: number
  longitude: number
  accuracy?: number | null
  battery_percent?: number | null
  device_info?: Record<string, unknown>
}): Promise<void> {
  await enqueueSyncItem('location_report', 'CREATE', payload)
}
