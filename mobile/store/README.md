# Legend State store (offline-first)

Single source of truth for local data; **SQLite has been removed**. All data lives in Legend State and is persisted to AsyncStorage.

- **`observable.ts`** – `appState$` holds `farmers`, `farms`, `schedules`, `visits`, `syncQueue`, plus `lastSyncAt` and `cachedStats`. Persisted under `mazao_store`.
- **`database.ts`** – Same async API as the old SQLite layer: `getFarmers`, `getFarms`, `getAllSchedulesForOfficer`, `getVisitsForOfficer`, `createOrUpdate*`, `enqueueSyncItem`, etc. All read/write the observable.
- **`helpers.ts`** – `normalizeServer*` to turn API responses into local row shape.
- **`types.ts`** – `FarmerRow`, `FarmRow`, `ScheduleRow`, `VisitRow`, `SyncQueueRow`.

Sync (`syncWithServer`) pushes the pending queue, pulls visits/schedules from the API, merges into the store, then fetches farmers/farms and sets them. No SQLite.
