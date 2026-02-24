import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations'

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
            { name: 'created_at', type: 'number', isOptional: true },
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
  ],
})
