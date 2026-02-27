import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations'

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'visits',
          columns: [
            { name: 'photo_uri', type: 'string', isOptional: true },
            { name: 'verification_status', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number', isOptional: false },
          ],
        }),
        addColumns({
          table: 'schedules',
          columns: [
            { name: 'created_by', type: 'string', isOptional: true },
            { name: 'approved_by', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
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
        }),
        createTable({
          name: 'farms',
          columns: [
            { name: 'farmer_id', type: 'string', isIndexed: true },
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
        }),
      ],
    },
  ],
})
