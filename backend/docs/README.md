# Mazao Backend — Developer Docs

Backend for the **Mazao Extension Visit Verification System**. Django + DRF + PostgreSQL + DigitalOcean Spaces for uploads in production.

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
| `DO_SPACES_ACCESS_KEY_ID` | Spaces access key (visit photos when bucket is set) |
| `DO_SPACES_SECRET_ACCESS_KEY` | Spaces secret key |
| `DO_SPACES_BUCKET_NAME` | Spaces bucket name |
| `DO_SPACES_REGION` | Datacenter slug, e.g. `fra1` |
| `DO_SPACES_MEDIA_PREFIX` | Optional; object prefix (default `media`) |
| `DO_SPACES_CDN_DOMAIN` | Optional; CDN hostname for public file URLs |
| `WEB_MAIL_API_URL` | Optional. Full URL of the Next.js mail endpoint, e.g. `https://your-app.com/api/internal/mail`. When set (with `WEB_MAIL_INTERNAL_SECRET`), transactional email is sent by the web app (Nodemailer) before falling back to Django SMTP. |
| `WEB_MAIL_INTERNAL_SECRET` | Shared secret; must match the web app `INTERNAL_MAIL_SECRET`. |

For **local dev without Spaces**, leave `DO_SPACES_BUCKET_NAME` empty; files are stored under `backend/media/` (see settings).

For **email via the web app**, set `WEB_MAIL_API_URL` and `WEB_MAIL_INTERNAL_SECRET`, and on the Next.js deployment set `INTERNAL_MAIL_SECRET` (same value), `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, plus optional `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`. Keep Django `SMTP_*` / `EMAIL_*` as fallback when web mail fails.

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
