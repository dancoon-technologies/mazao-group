# Mazao Backend — Developer Docs

Backend for the **Mazao Extension Visit Verification System**. Django + DRF + PostgreSQL + S3.

---

## Quick start

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
cp .env.example .env      # edit with your values
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API base: **http://localhost:8000/api/**

---

## Project layout

```
backend/
├── config/           # Django project settings
├── accounts/         # Custom User, auth
├── farmers/          # Farmer model, list API
├── visits/           # Visit model, create/list, GPS validation
├── docs/             # This documentation
├── requirements.txt
└── manage.py
```

---

## Environment variables

See `.env.example`. Main ones:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret (use a long random string in production) |
| `DEBUG` | `True` in dev, `False` in production |
| `DATABASE_URL` | PostgreSQL URL, e.g. `postgres://user:pass@localhost:5432/mazao` |
| `AWS_ACCESS_KEY_ID` | For S3 uploads (visits photos) |
| `AWS_SECRET_ACCESS_KEY` | For S3 |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket name |
| `AWS_S3_REGION_NAME` | e.g. `us-east-1` |

For **local dev without S3**, you can leave AWS vars unset; the app can store files locally (see settings).

---

## Database

- **Development:** SQLite works (default). For full compatibility use PostgreSQL.
- **Production:** PostgreSQL required.

Migrations:

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## Authentication

- **Method:** JWT via `djangorestframework-simplejwt`.
- **Login:** `POST /api/auth/login/` with `email` + `password` → returns `access` and `refresh`.
- **Protected endpoints:** send header `Authorization: Bearer <access_token>`.

See [API.md](./API.md) for request/response examples.

---

## User roles

| Role | Access |
|------|--------|
| **admin** | All farmers, all visits, dashboard, user management |
| **supervisor** | Visits and officers in assigned region only |
| **officer** | Assigned farmers only, own visits only |

Enforced in the backend only; never rely on frontend for security.

---

## GPS validation

- Visit is **only accepted** if officer’s location is within **100 m** of the farmer’s registered location.
- Distance is computed on the server using the Haversine formula; mobile sends `latitude` and `longitude`, but the server does the check and stores `distance_from_farmer`.

---

## Docs index

- **[API.md](./API.md)** — All endpoints, request/response shapes, errors.
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Production (Gunicorn, Nginx, SSL, env).

---

## Testing the API

1. Create a user (admin or officer) via Django admin or `createsuperuser`.
2. Login: `POST /api/auth/login/` → get `access` token.
3. Use the token in `Authorization: Bearer <access>` for:
   - `GET /api/farmers/`
   - `POST /api/visits/` (multipart: farmer_id, latitude, longitude, notes, photo)
   - `GET /api/visits/`
   - `GET /api/dashboard/stats/`

Use Postman, Insomnia, or curl; see API.md for examples.
