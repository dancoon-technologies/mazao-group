# Mazao Backend — Deployment

Production checklist: Ubuntu server, Gunicorn, Nginx, PostgreSQL, S3, SSL.

---

## 1. Server

- Ubuntu 22.04 LTS (or similar).
- Python 3.11+.
- PostgreSQL 14+.
- Nginx.

---

## 2. Application

- Run Django with **Gunicorn** (no `runserver` in production).
- Use a process manager (**PM2** or **systemd**) to keep Gunicorn running.

### PM2 (recommended for this repo)

From the **repo root** (e.g. `/var/www/mazao-group`):

```bash
# First time: ensure venv exists in backend and gunicorn is installed
cd backend
python -m venv .venv  # or create elsewhere and set path in ecosystem.config.cjs
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# Start
pm2 start ecosystem.config.cjs

# After deploy (e.g. git pull, migrate)
pm2 reload mazao-backend
# Or: pm2 restart all
```

The `ecosystem.config.cjs` in the repo root binds Gunicorn to `0.0.0.0:8000`. Put Nginx (or another proxy) in front and proxy to `http://127.0.0.1:8000`.

### systemd (alternative)

Example systemd unit (`/etc/systemd/system/mazao.service`):

```ini
[Unit]
Description=Mazao Gunicorn
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/mazao/backend
Environment="PATH=/var/www/mazao/venv/bin"
ExecStart=/var/www/mazao/venv/bin/gunicorn --workers 3 --bind unix:/var/www/mazao/backend.sock config.wsgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 3. Nginx

- Reverse proxy to the Gunicorn socket.
- Serve static files from Django’s `STATIC_ROOT` (after `collectstatic`).
- SSL via **Let’s Encrypt** (Certbot).

Example Nginx server block (after SSL):

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://unix:/var/www/mazao/backend.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 5M;
    }

    location /static/ {
        alias /var/www/mazao/backend/staticfiles/;
    }
}
```

`client_max_body_size 5M` matches the 5 MB photo limit.

---

## 4. Environment

- Set **SECRET_KEY** to a new, random value.
- Set **DEBUG=False**.
- Set **ALLOWED_HOSTS** to your API domain(s).
- Use **DATABASE_URL** (PostgreSQL).
- Configure **AWS_*** for S3 (access key, secret, bucket, region).

Never commit `.env` or secrets to the repo.

---

## 5. Database

- Create PostgreSQL database and user.
- Run migrations: `python manage.py migrate`.
- Create superuser: `python manage.py createsuperuser`.

---

## 6. Static files

```bash
python manage.py collectstatic --noinput
```

Point Nginx `location /static/` to the same path as `STATIC_ROOT`.

---

## 7. SSL

- Install Certbot: `apt install certbot python3-certbot-nginx`.
- Obtain certificate: `certbot --nginx -d api.yourdomain.com`.

---

## 8. Checklist

- [ ] SECRET_KEY changed, DEBUG=False, ALLOWED_HOSTS set
- [ ] PostgreSQL configured and migrated
- [ ] S3 bucket created; IAM user with read/write; env vars set
- [ ] Gunicorn + systemd running
- [ ] Nginx proxying and serving static files
- [ ] SSL in place and redirect HTTP → HTTPS
- [ ] Backups for database and critical config
