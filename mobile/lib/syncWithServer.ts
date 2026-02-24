import * as SecureStore from 'expo-secure-store'
import SyncQueue from '@/database/models/SyncQueue'
import { API_BASE, LAST_SYNC_KEY, STORAGE_KEYS, SYNC_PULL_PATH } from '@/constants/config'
import { database } from '@/database'
import { createOrUpdate, normalizeServerVisit, normalizeServerSchedule } from '@/database/helpers'
import Schedule from '@/database/models/Schedule'
import Visit from '@/database/models/Visit'

async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN)
}

async function getLastSync(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_SYNC_KEY)
}

async function setLastSync(iso: string): Promise<void> {
  await SecureStore.setItemAsync(LAST_SYNC_KEY, iso)
}

/** Push pending sync queue items to the server (visits via multipart, schedules via JSON) */
async function pushQueue(accessToken: string): Promise<{ ok: boolean; error?: string }> {
  const queue = database.get<SyncQueue>('sync_queue')
  const pending = await queue.query().fetch()
  const toSync = pending.filter((r) => r.status === 'pending')

  for (const item of toSync) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>
      if (item.entity === 'visit') {
        const form = new FormData()
        form.append('farmer_id', String(payload.farmer_id ?? payload.farmer))
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
          return { ok: false, error: (err.detail || err.photo?.[0] || 'Visit upload failed') as string }
        }
      } else if (item.entity === 'schedule') {
        const res = await fetch(`${API_BASE}/schedules/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            farmer: payload.farmer || null,
            scheduled_date: payload.scheduled_date,
            notes: payload.notes || '',
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return { ok: false, error: (err.detail || 'Schedule upload failed') as string }
        }
      }

      await database.action(async () => {
        await item.update((r) => {
          r.status = 'synced'
        })
      })
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Sync queue item failed',
      }
    }
  }
  return { ok: true }
}

/** Pull visits and schedules from server and merge into local DB */
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
    visits: Record<string, unknown>[]
    schedules: Record<string, unknown>[]
    server_time: string
  }
  const serverTime = data.server_time
  for (const v of data.visits ?? []) {
    const normalized = normalizeServerVisit(v)
    await createOrUpdate('visits', normalized, Visit as any)
  }
  for (const s of data.schedules ?? []) {
    const normalized = normalizeServerSchedule(s)
    await createOrUpdate('schedules', normalized, Schedule as any)
  }
  if (serverTime) await setLastSync(serverTime)
  return { ok: true, serverTime }
}

/**
 * Full sync: push pending queue (visits as multipart, schedules as JSON), then pull from server.
 * Requires auth. Returns { success, error? }.
 */
export async function syncWithServer(): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getAccessToken()
  if (!accessToken) return { success: false, error: 'Not authenticated' }

  const pushResult = await pushQueue(accessToken)
  if (!pushResult.ok) return { success: false, error: pushResult.error }

  const pullResult = await pullFromServer(accessToken)
  if (!pullResult.ok) return { success: false, error: pullResult.error }

  return { success: true }
}

export { getLastSync, setLastSync }

/** Enqueue a visit for later sync (offline). Payload must include photo_uri (local file path). */
export async function enqueueVisit(payload: {
  farmer_id: string
  farm_id?: string | null
  latitude: number
  longitude: number
  photo_uri: string
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
  const queue = database.get<SyncQueue>('sync_queue')
  await database.action(async () => {
    await queue.create((r) => {
      r.entity = 'visit'
      r.operation = 'CREATE'
      r.payload = JSON.stringify(payload)
      r.status = 'pending'
      r.timestamp = Date.now()
    })
  })
}

/** Enqueue a schedule for later sync (offline). */
export async function enqueueSchedule(payload: {
  farmer?: string | null
  scheduled_date: string
  notes?: string
}): Promise<void> {
  const queue = database.get<SyncQueue>('sync_queue')
  await database.action(async () => {
    await queue.create((r) => {
      r.entity = 'schedule'
      r.operation = 'CREATE'
      r.payload = JSON.stringify(payload)
      r.status = 'pending'
      r.timestamp = Date.now()
    })
  })
}

/** Get count of pending sync items */
export async function getPendingSyncCount(): Promise<number> {
  const queue = database.get<SyncQueue>('sync_queue')
  const pending = await queue.query().fetch()
  return pending.filter((r) => r.status === 'pending').length
}
