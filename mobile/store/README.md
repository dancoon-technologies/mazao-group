# Legend State store (offline-first)

Single source of truth for local data; **SQLite has been removed**. Data lives in Legend State and is persisted to AsyncStorage in **separate keys** to avoid one large blob and stay under storage limits.

**Split keys**

- **`appMeta$`** – `lastSyncAt`, `cachedStats` → `mazao_meta`
- **`farmers$`** → `mazao_farmers`
- **`farms$`** → `mazao_farms`
- **`schedules$`** → `mazao_schedules` (capped to `MAX_SCHEDULES`)
- **`visits$`** → `mazao_visits` (capped to `MAX_VISITS`)
- **`syncQueue$`** → `mazao_sync_queue`

**Caps** (`constants.ts`) – Visits and schedules are trimmed when written: only the most recent `MAX_VISITS` (2000) and `MAX_SCHEDULES` (2000) are kept. Oldest by date are dropped. Farmers and farms are not capped (typically smaller and needed for offline select).

**Files**

- **`observable.ts`** – One observable per slice, each with `persistObservable(..., { local: 'mazao_...' })`. Use `appMeta$` for lastSyncAt / cachedStats.
- **`database.ts`** – Same async API as the old SQLite layer; uses the split observables and applies caps in `createOrUpdateVisit` / `createOrUpdateSchedule`.
- **`helpers.ts`** – `normalizeServer*`: server API response → local row shape (used by sync).
- **`types.ts`** – Row types.

**`lib/offline-helpers.ts`** (outside store) – Row → API type mappers (`farmerRowToFarmer`, `scheduleRowToSchedule`, etc.) for list/detail UI. Store helpers = normalize server→row; offline-helpers = row→API shape.
