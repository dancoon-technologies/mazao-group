import { Model } from '@nozbe/watermelondb'
import { database } from './index'

/**
 * createOrUpdate - inserts or updates a record in WatermelonDB
 * @param tableName - 'visits' | 'schedules'
 * @param data - record payload from server
 * @param ModelClass - Visit or Schedule model class
 */
export async function createOrUpdate<T extends Model>(
    tableName: string,
    data: Record<string, any>,
    ModelClass: new (...args: any) => T
) {
    const collection = database.get(tableName)

    const existing = await collection.find(data.id).catch(() => null)

    await database.action(async () => {
        if (existing) {
            await existing.update((record) => {
                Object.entries(data).forEach(([key, value]) => {
                    // @ts-ignore
                    record[key] = value
                })
            })
        } else {
            await collection.create((record) => {
                Object.entries(data).forEach(([key, value]) => {
                    // @ts-ignore
                    record[key] = value
                })
            })
        }
    })
}