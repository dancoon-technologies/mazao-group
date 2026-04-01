# Operations Runbook

## 1) Environment Overview

- `backend/` API runtime
- `web/` management UI
- `mobile/` field app

## 2) Startup Checklist

- Backend healthy and reachable.
- Database connected and migrations current.
- Media storage accessible.
- Push integrations configured.
- Web env vars valid.
- Mobile API endpoint configured (`EXPO_PUBLIC_API_URL`).

## 3) Day-2 Operations

- Monitor error rates and auth failures.
- Track sync backlog and retry volume.
- Watch visit verification rejection trends.
- Review maintenance incident SLA aging.

## 4) Incident Response

### API Unavailable

1. Confirm service and DB health.
2. Validate network and DNS.
3. Check auth/refresh behavior.
4. Communicate operational fallback to teams.

### Mobile Sync Backlog Growth

1. Confirm backend queue endpoints healthy.
2. Check app version skew.
3. Verify payload validation contract changes.

### Verification Spike

1. Inspect location confidence and thresholds.
2. Review device permission denial rates.
3. Confirm no regression in GPS capture flow.

## 5) Backup and Recovery

- Define RPO/RTO at deployment level.
- Ensure database backups are automated and tested.
- Validate media backup/retention policy.
- Keep rollback procedure for backend and web releases.

## 6) Operational Metrics (Minimum)

- Login success/failure rate
- Visit submissions/day
- Visit verification outcome distribution
- Schedule approval lead time
- Sync success ratio
- Maintenance incident cycle times
