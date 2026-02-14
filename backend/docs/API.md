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
- **Officer:** only farmers assigned to that officer.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "name": "Farmer Name",
    "phone": "+255...",
    "latitude": -6.123,
    "longitude": 39.456,
    "crop_type": "Maize",
    "assigned_officer": "uuid",
    "created_at": "2025-02-14T10:00:00Z"
  }
]
```

---

## 3. Visits

### 3.1 Create visit

**POST** `/api/visits/`

**Content-Type:** `multipart/form-data`

**Body (form fields):**

| Field       | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| farmer_id  | UUID   | Yes      | ID of the farmer visited       |
| latitude   | float  | Yes      | Officer’s latitude             |
| longitude  | float  | Yes      | Officer’s longitude            |
| notes      | string | No       | Visit notes                    |
| photo      | file   | Yes      | Image file (max 5 MB, e.g. JPEG/PNG) |

**Success (201):**

```json
{
  "id": "visit-uuid",
  "officer": "officer-uuid",
  "farmer": "farmer-uuid",
  "latitude": -6.123,
  "longitude": 39.456,
  "photo": "https://bucket.s3.region.amazonaws.com/...",
  "notes": "Crop inspection done",
  "distance_from_farmer": 45.2,
  "verification_status": "verified",
  "created_at": "2025-02-14T12:00:00Z"
}
```

**Validation (400):**

- Farmer not found or not assigned to this officer.
- Distance from farmer > 100 m → `verification_status: "rejected"` and visit not created; response body explains “Visit rejected: officer is more than 100m from farmer”.

**Other errors:** 400 for missing/invalid fields or invalid image type/size.

---

### 3.2 List visits

**GET** `/api/visits/`

**Query params (optional):**

- `officer` — filter by officer UUID (admin/supervisor).
- `date` — filter by date (e.g. `2025-02-14`).

**Access:**

- **Admin:** all visits.
- **Supervisor:** visits in assigned region.
- **Officer:** own visits only.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "officer": "uuid",
    "farmer": "uuid",
    "latitude": -6.123,
    "longitude": 39.456,
    "photo": "https://...",
    "notes": "...",
    "distance_from_farmer": 45.2,
    "verification_status": "verified",
    "created_at": "2025-02-14T12:00:00Z"
  }
]
```

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

## 6. Summary table

| Method | Endpoint              | Auth | Description        |
|--------|------------------------|------|--------------------|
| POST   | `/api/auth/login/`     | No   | Get access/refresh  |
| POST   | `/api/auth/refresh/`   | No   | Get new access      |
| GET    | `/api/farmers/`        | Yes  | List farmers        |
| POST   | `/api/visits/`         | Yes  | Create visit        |
| GET    | `/api/visits/`         | Yes  | List visits         |
| GET    | `/api/dashboard/stats/`| Yes  | Dashboard stats     |
