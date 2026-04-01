# Backend API

## 1) Base Principles

- API style: RESTful, JSON payloads (multipart for photo uploads where needed).
- Authentication: JWT bearer tokens.
- Authorization: role + scope aware (admin/supervisor/officer).
- Error style: validation-first, user-readable feedback where possible.

## 2) Main Endpoint Groups

### Auth and Account

- `/auth/login/`
- `/auth/refresh/`
- `/auth/change-password/`

### Master Data

- `/farmers/`, `/farmers/{id}/`
- `/farms/`, `/farms/{id}/`
- `/locations/`
- `/officers/`
- `/options/`

### Execution

- `/visits/`, `/visits/{id}/`, `/visits/{id}/verify/`
- `/schedules/`, `/schedules/{id}/`, `/schedules/{id}/approve/`
- `/routes/`, `/routes/{id}/`, `/routes/{route_id}/report/`

### Monitoring and Reporting

- `/dashboard/stats/`
- `/dashboard/stats-by-department/`
- `/dashboard/visits-by-day/`
- `/dashboard/visits-by-activity/`
- `/dashboard/top-officers/`
- `/dashboard/product-ranking/`
- `/dashboard/staff-ranking/`
- `/dashboard/schedules-summary/`

### Tracking and Notifications

- `/tracking/time/`
- `/tracking/reports/`
- `/tracking/reports/batch/`
- `/notifications/*`

### Maintenance Control

- `/maintenance-incidents/` (list/create)
- `/maintenance-incidents/{id}/` (update lifecycle)

> If maintenance endpoints are versioned differently in backend deployment, update this page to the deployed URI map.

## 3) Request/Response Patterns

- **List endpoints:** support pagination/filtering where configured.
- **Create/update endpoints:** return canonical object payload.
- **Validation errors:** field-level and detail-level messages.
- **Auth errors:** `401` for invalid/expired session.
- **Permission errors:** `403` for role/scope restrictions.

## 4) Integration Guidance

- Always send access token in `Authorization: Bearer <token>`.
- For visit photo capture, use multipart form data.
- Preserve optional nullable fields as `null` when clearing state.
- Keep client fallback logic for offline and retries.

## 5) Versioning and Change Control

- Treat schema-affecting updates as contract changes.
- Update this wiki page and corresponding client mappings together.
- Add migration notes for any new required field.
