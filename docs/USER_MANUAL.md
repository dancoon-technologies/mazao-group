# Mazao Group — User Manual

**Product:** Field operations platform (web portal + **Mazao Monitor** mobile app)  
**Audience:** Extension officers, supervisors, and administrators  
**Document version:** 1.0 · **Last updated:** April 2026  

This file is the **entry-point manual**. Detailed walkthroughs with screenshot placeholders live in the wiki:

| Guide | Location |
|--------|----------|
| Web (supervisor / admin) | [docs/wiki/Web-User-Manual.md](wiki/Web-User-Manual.md) |
| Mobile (officer / supervisor) | [docs/wiki/Mobile-User-Manual.md](wiki/Mobile-User-Manual.md) |
| Step-by-step by role | [docs/wiki/Role-Based-SOPs.md](wiki/Role-Based-SOPs.md) |
| Vehicle maintenance workflow | [docs/wiki/Maintenance-Control-Module.md](wiki/Maintenance-Control-Module.md) |
| Common issues | [docs/wiki/Troubleshooting-FAQ.md](wiki/Troubleshooting-FAQ.md) |

---

## 1. Roles at a glance

| Role | Typical use | Web portal | Mobile app |
|------|-------------|------------|------------|
| **Extension officer** | Field visits, customers, schedules, maintenance reports | Limited (e.g. password change); primary work on phone | Full field workflow |
| **Supervisor** | Approve schedules, verify visits, track team, department oversight | Yes — dashboard, schedules, visits (where allowed), tracking, maintenance | Same core tasks as officers plus **Track team** |
| **Administrator** | Org setup, staff accounts, global reports | All supervisor pages plus **Staff**, full dashboard metrics | Same as supervisor unless restricted by policy |

*Navigation items on web are hidden automatically if your role cannot access them.*

---

## 2. Getting access

1. Your **administrator** creates your account and sends credentials (email with a temporary password where configured).
2. **First sign-in:** you may be forced to **change your password** before continuing.
3. **Mobile (officers):** one phone is bound per account. If you change devices, ask a supervisor or admin to **reset device binding**, then sign in again on the new phone.
4. **Web (staff):** sign in with HTTPS. The browser may store a session; use **Log out** on shared computers.

---

## 3. Web application (Mazao Group)

**URL:** Provided by your organisation (production or staging).

### 3.1 Main areas (by menu)

| Area | Purpose | Typical roles |
|------|---------|----------------|
| **Dashboard** | KPIs, charts, staff ranking links, shortcuts | Admin, supervisor |
| **Customers** | All customer types in one place: tabs for *All*, individuals, farmer groups, **stockists**, **SACCOs**; add and edit records | Admin, supervisor |
| **Farms** | Farm / land locations linked to customers | Admin, supervisor |
| **Outlets** | Outlet locations (e.g. retail points) | Admin, supervisor |
| **Visits** | List and inspect visits; filters; verification where policy allows | Admin, supervisor |
| **Sales** | Sales reporting views (period filters) | Admin, supervisor |
| **Schedules** | Proposed vs accepted plans; approve or reject (with reason when rejecting) | Admin, supervisor, officer (propose / accept own work per policy) |
| **Track team** | Map and history of officer location reports | Admin, supervisor |
| **Maintenance** | Vehicle incidents: officers report; supervisors verify / acknowledge / reject | All authenticated (workflow differs by role) |
| **Staff** | Register staff, assign department/region, resend credentials, reset device | **Admin only** |

*Users who only exist for **Django admin** (`is_staff` / `is_superuser`) do **not** appear in the Staff list; they are portal operators, not field staff.*

### 3.2 Maintenance on the web

- **Officer:** submit breakdown (description + GPS from browser when reporting).
- **Supervisor:** **Verify breakdown** or **Reject** while status is *Reported*. Verifying does **not** require the supervisor’s browser GPS.  
- After the officer marks **Repair at garage**, the supervisor may **Acknowledge** or **Reject**.

*(See wiki [Maintenance Control Module](wiki/Maintenance-Control-Module.md) for the full state model; the wiki diagram may still show older labels — code uses **Released** for final acknowledgement.)*

---

## 4. Mobile application (Mazao Monitor)

### 4.1 Where to find things

- **Bottom tabs:** Home, Schedules, Customers, History (and other tabs as configured).
- **Drawer menu:** Profile, Schedules & visits, Customers, History, **Track team** (supervisors/admins), **Report incident** (maintenance), change password, log out.

### 4.2 Core tasks

| Task | Summary |
|------|---------|
| **Record visit** | Choose planned visit or route (if applicable), customer and location, activity types, GPS and **photo** evidence, optional extra fields, submit. Works with offline queue when connectivity is poor. |
| **Customers** | Search; filter by type (individual, group, stockist, SACCO); open detail; add new with map location. |
| **Schedules** | Propose weekly or single-day plans (per permissions); accept or manage proposals. |
| **Route report** | End-of-day summary for routes that had visits; one **Remarks** field (plus visit count sent automatically). |
| **Maintenance** | Officer: report issue with GPS. Supervisor: verify breakdown on device; officer then marks **at garage** when applicable. |
| **Track team** | Supervisors: view team location trail (when tracking is enabled and within working hours). |

App **version** and **EAS Update** metadata are sent on login/refresh so support can see what build you use (Django admin user record).

---

## 5. Preparing this manual for distribution

1. **Export to PDF:** open this file and the wiki pages in VS Code, GitHub, or a Markdown viewer and print / export to PDF.  
2. **Screenshots:** replace placeholders under `docs/wiki/images/` referenced in [Web](wiki/Web-User-Manual.md) and [Mobile](wiki/Mobile-User-Manual.md) manuals.  
3. **Localise:** duplicate the wiki pages and translate if you support multiple languages.  
4. **Train-the-trainer:** use [Role-Based SOPs](wiki/Role-Based-SOPs.md) for workshop checklists.

---

## 6. Support and escalation

- **Field blocking issues:** device binding, login, GPS — see [Troubleshooting FAQ](wiki/Troubleshooting-FAQ.md).  
- **Process questions:** supervisor → admin → see [Operations Runbook](wiki/Operations-Runbook.md) for your organisation’s escalation path.

---

*For technical API and architecture details, see [Backend API](wiki/Backend-API.md) and [System Architecture](wiki/System-Architecture.md).*
