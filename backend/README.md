# Mazao Backend

Django + DRF backend for the **Mazao Extension Visit Verification System**.

## Docs

- **[docs/README.md](docs/README.md)** — Setup, layout, auth, GPS, testing
- **[docs/API.md](docs/API.md)** — Full API reference (auth, farmers, visits, dashboard)
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Production deployment

## Quick start

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env      # optional; edit for DB, S3, CORS
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API: **http://localhost:8000/api/**  
Admin: **http://localhost:8000/admin/**

**Tests:** `python manage.py test accounts farmers visits`

## Apps

| App       | Purpose                          |
|----------|-----------------------------------|
| `accounts` | Custom User (email, role, region) |
| `farmers`  | Farmer model, list API            |
| `visits`   | Visit create/list, GPS validation, dashboard stats |
