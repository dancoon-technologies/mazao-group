# Mazao Backend — API Reference

Base URL: **`/api/`** (e.g. `http://localhost:8000/api/`).

All authenticated endpoints require:

```http
Authorization: Bearer <access_token>
```

---

## 1. Authentication

### 1.1 Login

**POST** `/api/auth/login/`

**Request (JSON):** Use `email` (not username).

```json
{
  "email": "officer@example.com",
  "password": "your_password"
}
```

**Response (200):**

```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Errors:** 401 if credentials invalid.

---

### 1.2 Refresh token

**POST** `/api/auth/refresh/`

**Request (JSON):**

```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response (200):**

```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

## 2. Farmers

### 2.1 List farmers

**GET** `/api/farmers/`

**Access:**

- **Admin:** all farmers.
- **Supervisor:** farmers whose assigned officer is in supervisor’s department (or region if no department).
- **Officer:** only farmers assigned to that officer.

**Response (200):** Array of farmers; each has `id`, `title`, `first_name`, `middle_name`, `last_name`, `display_name`, `phone`, `latitude`, `longitude`, `assigned_officer`, `created_at`.

---

## 2.2 Farms (farming lands)

A farmer can have **more than one farm** (piece of farming land). Each farm has location (county, sub_county, village, lat/lon), plot_size, crop_type.

### List farms

**GET** `/api/farms/`

**Query params (optional):**

- `farmer` — filter by farmer UUID.

**Access:** Admin, supervisor, and officers all see all farms (e.g. for propose schedule when picking any farmer).

**Response (200):** Array of objects with `id`, `farmer`, `county`, `sub_county`, `village`, `latitude`, `longitude`, `plot_size`, `crop_type`, `created_at`.

### Create farm

**POST** `/api/farms/`

**Body (JSON):**

| Field       | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| farmer_id  | UUID   | Yes      | Farmer who owns this farm      |
| county     | string | Yes      |                                |
| sub_county | string | Yes      |                                |
| village    | string | Yes      |                                |
| latitude   | float  | Yes      |                                |
| longitude  | float  | Yes      |                                |
| plot_size  | string | No       | e.g. "2 acres"                 |
| crop_type  | string | No       |                                |

**Access:** Admin or officer assigned to that farmer. Returns 201 with created farm.

---

## 3. Visits

### 3.1 Create visit

**POST** `/api/visits/`

**Content-Type:** `multipart/form-data`

**Body (form fields):**

| Field             | Type   | Required | Description                                                    |
|------------------|--------|----------|----------------------------------------------------------------|
| farmer_id        | UUID   | Yes      | ID of the farmer visited                                       |
| farm_id          | UUID   | No       | Which farm (plot) was visited; used for distance check         |
| latitude         | float  | Yes      | Officer’s latitude                                             |
| longitude        | float  | Yes      | Officer’s longitude                                            |
| notes            | string | No       | Visit notes                                                    |
| photo            | file   | Yes      | Image file (max 5 MB, e.g. JPEG/PNG)                           |
| activity_type    | string | No       | Field activity type (default `farm_to_farm_visits`). See §7.2 in README. |
| crop_stage       | string | No       |                                                                |
| germination_percent | number | No    |                                                                |
| survival_rate   | string | No       |                                                                |
| pests_diseases   | string | No       |                                                                |
| order_value      | number | No       |                                                                |
| harvest_kgs      | number | No       |                                                                |
| farmers_feedback | string | No       |                                                                |

**Success (201):** Visit object including `id`, `officer`, `farmer`, `farm` (nullable), `latitude`, `longitude`, `photo`, `notes`, `distance_from_farmer`, `verification_status`, `activity_type`, `crop_stage`, `germination_percent`, `survival_rate`, `pests_diseases`, `order_value`, `harvest_kgs`, `farmers_feedback`, `created_at`.

**Validation (400):**

- Farmer not found or not assigned to this officer.
- If `farm_id` provided: farm must exist and belong to that farmer.
- Distance from farmer/farm > 100 m → visit not created; response: “Visit rejected: officer is more than 100m from farmer/farm.” Distance is computed against the given farm, or the farmer’s nearest farm, or the farmer’s own location.

**Other errors:** 400 for missing/invalid fields or invalid image type/size.

---

### 3.2 List visits

**GET** `/api/visits/`

**Query params (optional):**

- `officer` — filter by officer UUID (admin/supervisor).
- `date` — filter by date (e.g. `2025-02-14`).

**Access:**

- **Admin:** all visits.
- **Supervisor:** visits in assigned department (or region if no department).
- **Officer:** only their own visits (list returns 200 with officer-scoped data).

**Response (200):** Array of visit objects including `farm`, `activity_type`, and report fields (see create response).

---

## 4. Dashboard

### 4.1 Stats

**GET** `/api/dashboard/stats/`

**Access:** Admin and Supervisor (and optionally Officer for their own context; implementation can restrict to admin/supervisor if needed).

**Response (200):**

```json
{
  "visits_today": 15,
  "visits_this_month": 210,
  "active_officers": 12
}
```

- **visits_today:** count of visits with `created_at` today (server timezone).
- **visits_this_month:** count for current month.
- **active_officers:** count of distinct officers who created at least one visit (e.g. in last 30 days or all time; document exact rule in your backend).

---

## 5. Error format

DRF default style:

**400 Bad Request:**

```json
{
  "field_name": ["Error message."]
}
```

**401 Unauthorized:** Missing or invalid token.

**403 Forbidden:** Valid token but not allowed to access this resource.

**404 Not Found:** Resource does not exist or not visible to this user.

---

## 6. Schedules

### List / create schedules

**GET** `/api/schedules/` — List schedules. Admin: all. Supervisor: department/region. Officer: own.

**POST** `/api/schedules/` — Create schedule.

- **Admin/Supervisor:** Body must include `officer` (UUID), and optionally `farmer`, `scheduled_date`, `notes`. Creates schedule with status `accepted` and `approved_by` = creator. Officer is notified.
- **Officer:** Body: `farmer` (optional), `scheduled_date`, `notes`. Creates schedule with status `proposed` (officer = self). No `officer` in body or must be self.

**Response (list/item):** Includes `id`, `created_by`, `officer`, `officer_email`, `farmer`, `farmer_display_name`, `scheduled_date`, `notes`, `status` (`proposed` | `accepted` | `rejected`), `approved_by`, `created_at`.

### Approve or reject schedule (proposal)

**POST** `/api/schedules/<uuid:pk>/approve/`

**Body (JSON):** `{ "action": "accept" | "reject" }`

**Access:** Admin or Supervisor (schedule must be in supervisor’s department/region). Schedule must be in status `proposed`. On accept/reject, officer is notified.

**Response (200):** Updated schedule object.

---

## 7. Staff (admin only)

**GET** `/api/staff/` — List staff (supervisors and officers). Response includes `id`, `email`, `first_name`, `middle_name`, `last_name`, `display_name`, `phone`, `role`, `department`, `region`.

**POST** `/api/staff/` — Invite staff. Body: `email`, `role` (`supervisor` | `officer`), `first_name`, `middle_name`, `last_name`, `phone`, `department`, `region`. Department values: `mazao_na_afya`, `agritech`, `agripriize`. Sends temporary password by email.

---

## 8. Summary table

| Method | Endpoint                           | Auth | Description            |
|--------|-------------------------------------|------|------------------------|
| POST   | `/api/auth/login/`                  | No   | Get access/refresh     |
| POST   | `/api/auth/refresh/`                | No   | Get new access         |
| GET    | `/api/farmers/`                     | Yes  | List farmers           |
| GET    | `/api/farms/`                       | Yes  | List farms             |
| POST   | `/api/farms/`                       | Yes  | Create farm            |
| POST   | `/api/visits/`                      | Yes  | Create visit           |
| GET    | `/api/visits/`                      | Yes  | List visits            |
| GET    | `/api/dashboard/stats/`             | Yes  | Dashboard stats        |
| GET    | `/api/schedules/`                   | Yes  | List schedules         |
| POST   | `/api/schedules/`                   | Yes  | Create schedule        |
| POST   | `/api/schedules/<uuid:pk>/approve/` | Yes  | Accept/reject schedule |
| GET    | `/api/staff/`                       | Yes  | List staff (admin)     |
| POST   | `/api/staff/`                       | Yes  | Invite staff (admin)   |
