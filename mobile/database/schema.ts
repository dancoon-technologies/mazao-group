// database/schema.ts
import { tableSchema, appSchema } from '@nozbe/watermelondb'

export const visitSchema = tableSchema({
  name: 'visits',
  columns: [
    { name: 'id', type: 'string' },
    { name: 'officer', type: 'string' },
    { name: 'farmer', type: 'string' },
    { name: 'farm', type: 'string', isOptional: true },
    { name: 'latitude', type: 'number' },
    { name: 'longitude', type: 'number' },
    { name: 'photo_uri', type: 'string', isOptional: true },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'activity_type', type: 'string', isOptional: true },
    { name: 'verification_status', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number', isOptional: true },
    { name: 'updated_at', type: 'number' },
    { name: 'is_deleted', type: 'boolean' },
  ],
})

export const scheduleSchema = tableSchema({
  name: 'schedules',
  columns: [
    { name: 'id', type: 'string' },
    { name: 'officer', type: 'string' },
    { name: 'farmer', type: 'string', isOptional: true },
    { name: 'scheduled_date', type: 'number' },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'status', type: 'string' },
    { name: 'created_by', type: 'string', isOptional: true },
    { name: 'approved_by', type: 'string', isOptional: true },
    { name: 'updated_at', type: 'number' },
    { name: 'is_deleted', type: 'boolean' },
  ],
})

export const syncQueueSchema = tableSchema({
  name: 'sync_queue',
  columns: [
    { name: 'id', type: 'string' },
    { name: 'operation', type: 'string' }, // CREATE / UPDATE / DELETE
    { name: 'entity', type: 'string' }, // visit / schedule
    { name: 'payload', type: 'string' }, // JSON string
    { name: 'status', type: 'string' }, // pending / synced
    { name: 'timestamp', type: 'number' },
  ],
})

export const schema = appSchema({
  version: 2,
  tables: [visitSchema, scheduleSchema, syncQueueSchema],
})