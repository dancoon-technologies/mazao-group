/**
 * PM2 ecosystem config for Mazao backend (Django + Gunicorn).
 *
 * Usage:
 *   From repo root:  pm2 start ecosystem.config.cjs
 *   Reload after deploy:  pm2 reload mazao-backend
 *   Logs:  pm2 logs mazao-backend
 *
 * Requires: pip install gunicorn (or add to requirements.txt).
 * Venv: expects backend/.venv (or set script to your venv path).
 */

const path = require('path');

const backendDir = path.join(__dirname, 'backend');
// Venv in backend (e.g. /var/www/mazao-group/backend/.venv)
const gunicorn = path.join(backendDir, '.venv', 'bin', 'gunicorn');

module.exports = {
  apps: [
    {
      name: 'mazao-backend',
      script: gunicorn,
      args: 'config.wsgi:application --bind 0.0.0.0:8000 --workers 2 --timeout 60',
      cwd: backendDir,
      interpreter: 'none',
      env: {
        DJANGO_SETTINGS_MODULE: 'config.settings',
      },
      env_production: {
        NODE_ENV: 'production',
        DJANGO_SETTINGS_MODULE: 'config.settings',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      merge_logs: true,
    },
  ],
};
