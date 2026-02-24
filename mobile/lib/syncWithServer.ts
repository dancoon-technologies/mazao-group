import SyncQueue from '@/database/models/SyncQueue'
import { API_BASE } from '../constants/config'
import { database } from '../database'
import { createOrUpdate } from '../database/helpers'
import Schedule from '../database/models/Schedule'
import Visit from '../database/models/Visit'

export const syncWithServer = async () => {
    try {
        const queue = await database.get<SyncQueue>('sync_queue').query().fetch()
        for (const item of queue) {
            await fetch(`${API_BASE}/${item.entity}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.payload),
            })
            await database.action(() => item.update((r) => r.status = 'synced'))
        }

        const visitResp = await fetch(`${API_BASE}/visits/`)
        const visits = await visitResp.json()
        for (const v of visits) await createOrUpdate('visits', v, Visit)

        const scheduleResp = await fetch(`${API_BASE}/schedules/`)
        const schedules = await scheduleResp.json()
        for (const s of schedules) await createOrUpdate('schedules', s, Schedule)

        console.log('Sync completed')
    } catch (err) {
        console.error('Sync failed', err)
    }
}