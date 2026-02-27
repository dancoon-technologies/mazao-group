// database/schema.ts
import { tableSchema, appSchema } from '@nozbe/watermelondb'

export const visitSchema = tableSchema({
  name: 'visits',
  columns: [
    { name: 'officer', type: 'string' },
    { name: 'farmer', type: 'string' },
    { name: 'farm', type: 'string', isOptional: true },
    { name: 'latitude', type: 'number' },
    { name: 'longitude', type: 'number' },
    { name: 'photo_uri', type: 'string', isOptional: true },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'activity_type', type: 'string', isOptional: true },
    { name: 'verification_status', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number', isOptional: false },
    { name: 'updated_at', type: 'number' },
    { name: 'is_deleted', type: 'boolean' },
  ],
})

export const scheduleSchema = tableSchema({
  name: 'schedules',
  columns: [
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
    { name: 'operation', type: 'string' }, // CREATE / UPDATE / DELETE
    { name: 'entity', type: 'string' }, // visit / schedule
    { name: 'payload', type: 'string' }, // JSON string
    { name: 'status', type: 'string' }, // pending / synced
    { name: 'timestamp', type: 'number' },
  ],
})

export const farmerSchema = tableSchema({
  name: 'farmers',
  columns: [
    { name: 'first_name', type: 'string' },
    { name: 'middle_name', type: 'string', isOptional: true },
    { name: 'last_name', type: 'string' },
    { name: 'display_name', type: 'string', isOptional: true },
    { name: 'phone', type: 'string', isOptional: true },
    { name: 'latitude', type: 'string', isOptional: true },
    { name: 'longitude', type: 'string', isOptional: true },
    { name: 'crop_type', type: 'string', isOptional: true },
    { name: 'assigned_officer', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number', isOptional: false },
  ],
})

export const farmSchema = tableSchema({
  name: 'farms',
  columns: [
    { name: 'farmer_id', type: 'string' },
    { name: 'village', type: 'string' },
    { name: 'latitude', type: 'number' },
    { name: 'longitude', type: 'number' },
    { name: 'plot_size', type: 'string', isOptional: true },
    { name: 'crop_type', type: 'string', isOptional: true },
    { name: 'region_id', type: 'number', isOptional: true },
    { name: 'county_id', type: 'number', isOptional: true },
    { name: 'sub_county_id', type: 'number', isOptional: true },
    { name: 'region', type: 'string', isOptional: true },
    { name: 'county', type: 'string', isOptional: true },
    { name: 'sub_county', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number', isOptional: false },
  ],
})

export const schema = appSchema({
  version: 3,
  tables: [visitSchema, scheduleSchema, syncQueueSchema, farmerSchema, farmSchema],
})