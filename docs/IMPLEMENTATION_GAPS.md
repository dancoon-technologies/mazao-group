# Implementation Gaps vs README (System Design)

This document lists what is **not implemented** or **incomplete** across backend, web, and mobile when checked against the README (§1–§9).

---

## Summary

| Area | Status | Gaps |
|------|--------|------|
| **Backend** | Complete | — |
| **Web** | Complete | — |
| **Mobile** | Complete | — |

---

## 1. Backend

### Implemented (per README)

- **§2–§3** Three roles, three departments, JWT auth, visit verification (GPS + photo, 100 m), scoping by department/region.
- **§4** User, Farmer, Farm, Visit, Schedule models with required attributes; Farm has location IDs (region, county, sub_county); Visit has activity_type and report fields.
- **§5.1**  
  - User & access management: invite (staff create + email temp password), deactivate (PATCH `is_active`), assign department/region (PATCH staff).  
  - Visit recording, farmer onboarding, schedule proposal/approval, dashboard stats, visit list (filter officer/date), visit verification (distance + photo).
- **§5.2** UC1–UC7 supported by API (invite/assign, deactivate, record visit, add farmer, propose schedule, accept/reject schedule, dashboard and visits).
- **§6** Anti-ghost (GPS, distance check, photo), departments and region on User.
- **§7** Activity types enum; report fields on Visit/Farm; sync pull/push (mobile).
- **§9.3** Design decisions (officer naming, schedule propose/accept, Farmer/Farm/Visit model) reflected in code.

### Not implemented / gaps

- **API docs**  
  - README §9.2 references `backend/docs/API.md` and `backend/docs/DEPLOYMENT.md`. Both exist and are in use.
- **Officer list visits**  
  - Backend allows officers to list their own visits; API.md updated. Mobile History works for officers.
- **Report export (backend)**  
  - Web provides Excel and PDF client-side; no backend export endpoint required for current design.

---

## 2. Web

### Implemented (per README)

- **§3.2** Web for supervisors/admins: dashboard, visit lists, schedule approval, user/department management.
- **§5**  
  - UC1: Invite and assign (staff create + assign department/region, deactivate).  
  - UC2: Deactivate user (staff PATCH `is_active`).  
  - UC5/UC6: Propose schedule (officer), accept/reject (supervisor), officer notified (backend).  
  - UC7: Dashboard (stats, recent visits), visit list with filter by officer and date.
- **§6** Scoped visibility: dashboard and visits scoped by role (admin/supervisor); officers see only allowed pages (e.g. Schedules, Farmers, Farms).
- **§7** Visit list and detail show activity type and report fields; Excel export of visits (client-side) aligned with visit/farmer data.
- **First-login flow**  
  - After invite, user gets temp password by email.  
  - Web login checks `must_change_password` and redirects to change-password; layout enforces redirect until password is changed.

### Not implemented / gaps

- **PDF export (§7.3)**  
  - README: “Exports (PDF/Excel) should follow the visit/farmer report template.”  
  - **Implemented.** Web visits page has "Export PDF" alongside Excel; PDF includes report fields per README.
- **Report template strictness**  
  - README §4.3 / §7.1: Report template mapping (county, sub_county, village, farmer name/contact, geo, plot size, crop, visit fields).  
  - Excel export already includes the main fields; no separate “report template” view or PDF that strictly follows §4.3/§7.1. Optional improvement: explicit report template (screen or PDF) matching README table.

---

## 3. Mobile

### Implemented (per README)

- **§3.2** Mobile for field officers: record visit, add farmer/farm, propose schedule.
- **§5**  
  - UC3: Record visit (farmer/farm, GPS + photo, activity type, optional report fields).  
  - UC4: Add farmer and ≥1 farm (location: region/county/sub_county, village, plot size, crop).  
  - UC5: Propose schedule (date, optional farmer, notes).
- **§6** Anti-ghost: GPS and photo at record time; distance check done on backend; verification status shown where visits are listed.
- **§7** Activity types (full list); report fields on record-visit form.
- **Offline-first**  
  - README §9.1 originally “out of scope” for “Offline-first mobile behaviour and sync rules”; now implemented: WatermelonDB, sync queue, push (visits as multipart, schedules as JSON), pull (mobile sync), sync on reconnect, “Sync now” in profile.

### Not implemented / gaps

- **Change password / first-login flow (UC1)**  
  - README UC1: “Admin invites user → **user sets password** → Admin assigns department (and region) → user can log in.”  
  - **Implemented.** Mobile now enforces change-password when `must_change_password` is true (decode JWT, redirect to `/change-password`, then to app).  

- **View "my" visits on mobile**  
  - **Implemented.** Backend returns officer-scoped list; mobile History tab shows it. API.md updated.

---

## 4. Cross-cutting (README §7.3)

- **Report as output**  
  - **Screen:** Implemented (web dashboard + visits list; mobile record-visit and history message).  
  - **Excel:** Implemented (web visits export).  
  - **PDF:** Implemented (web visits page Export PDF).
- **“Report template” alignment**  
  - Data model and visit/farmer fields match README §4.3 and §7.1.  
  - No separate “report template” UI or PDF layout that explicitly mirrors the README table; Excel is the main export and is broadly aligned.

---

## 5. Checklist vs README

| README section | Backend | Web | Mobile |
|----------------|---------|-----|--------|
| §2.2 Three departments | Yes | Yes (options) | N/A |
| §2.3 Admin: invite, deactivate, assign | Yes | Yes (staff page) | N/A |
| §2.3 Supervisor: dashboard, visits, accept schedules | Yes | Yes | N/A |
| §2.3 Field officer: record visit, add farmer | Yes | N/A | Yes |
| §5.1 (1) User & access management | Yes | Yes | N/A |
| §5.1 (2) Visit recording | Yes | N/A | Yes |
| §5.1 (3) Farmer onboarding | Yes | N/A | Yes |
| §5.1 (4) Schedule proposal | Yes | Yes (schedules) | Yes |
| §5.1 (5) Schedule approval | Yes | Yes | N/A |
| §5.1 (6) Insights & reporting | Yes | Yes | Yes (History / own visits) |
| §5.1 (7) Visit verification (system) | Yes | Shown | Shown |
| §5.2 UC1 Invite and assign | Yes | Yes | **Yes (change-password enforced)** |
| §5.2 UC2 Deactivate | Yes | Yes | N/A |
| §5.2 UC3–UC5, UC7 | Yes | Yes (where applicable) | Yes |
| §5.2 UC6 Accept/reject + notify | Yes | Yes | N/A |
| §7.2 Activity types | Yes | Shown | Yes (full list) |
| §7.3 Report output PDF/Excel | No PDF | **Excel + PDF** | N/A |
| §9.1 Offline-first (was out of scope) | Sync API | N/A | Implemented |

---

## 6. Recommended next steps

1. ~~**PDF export**~~ — Done (web Export PDF).
2. ~~**Mobile: change password / first login**~~ — Done.

3. **Optional (future)**  
   - Backend: add a dedicated report/export endpoint (e.g. PDF or Excel) for visits (and template fields) if you want server-side reports.  
   - Web: add a “Report template” view or PDF that strictly follows the README table.  
   - (Officer visit history on mobile is implemented: backend returns officer-scoped list.)

---

*Generated from README.md (system design v1.0) and codebase review.*
