import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import Schedule from './models/Schedule'
import SyncQueue from './models/SyncQueue'
import Visit from './models/Visit'
import migrations from './migrations'
import { schema } from './schema'

const adapter = new SQLiteAdapter({
  schema,
  migrations,
})

export const database = new Database({
    adapter,
    modelClasses: [Visit, Schedule, SyncQueue],
})
