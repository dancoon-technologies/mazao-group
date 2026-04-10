# Web User Manual

Supervisor and **administrator** workflows in the **Mazao Group** web app. Officers use the **Mazao Monitor** mobile app for most day-to-day tasks; the web is mainly for oversight, approvals, and configuration.

**Master index:** [User Manual (overview)](../USER_MANUAL.md)

---

## 1) Login

1. Open your organisation’s web URL (**HTTPS** required except on localhost).
2. Enter **email** and **password**.
3. If you see **Change password**, complete it before continuing (first-time or forced reset).

![Placeholder - Web login](images/web/login.png)

---

## 2) Dashboard

- Summary KPIs: visits, verification, active officers (field staff only), and more for admins.
- Charts: visits by day, by activity, etc.
- **Staff ranking** (admins / supervisors): productivity-style metrics over a selectable period.
- Shortcuts (e.g. to **Customers**, **Staff** for admins).

![Placeholder - Web dashboard](images/web/dashboard.png)

---

## 3) Customers

Single **Customers** page with **tabs**:

- **All** — everyone.
- **Individual** — farmers (person accounts).
- **Farmer groups** — group accounts.
- **Stockists** — stockist-type partners.
- **SACCOs** — SACCO-type partners.

Use **Add customer** and the segmented control to pick the type. Each row shows **Type**, contact, and a link to the detail page.

![Placeholder - Customers](images/web/customers.png)

---

## 4) Farms and Outlets

- **Farms:** manage farm / plot records linked to customers (regions, counties, map where configured).
- **Outlets:** manage outlet-type locations (e.g. retail) with geography and linkage to stockists where applicable.

---

## 5) Staff (Admin only)

- List **supervisors** and **extension officers** registered for the portal.
- **Portal-only note:** users flagged as Django **staff** or **superusers** (internal admin logins) **do not** appear in this list; they are not treated as field staff in the app UI.
- Register new staff, assign **department** and location, deactivate/reactivate.
- **Resend credentials** and **Reset device** (clears phone binding so the officer can sign in on a new device).

![Placeholder - Staff management](images/web/staff-management.png)

---

## 6) Schedules and approvals

- Filter by officer, date, status.
- **Approve** or **reject** proposed schedules; rejection should include a clear **reason** when the UI asks for it.
- Admins/supervisors may create or assign schedules for officers depending on policy.

![Placeholder - Schedules table](images/web/schedules-table.png)
![Placeholder - Approve/reject modal](images/web/schedule-approval-modal.png)

---

## 7) Visits and verification

- Browse visits with filters (officer, date, activity, etc.).
- Open a visit to see evidence and metadata.
- **Verify** or **reject** visits when your role allows (anti-ghosting / quality control).

![Placeholder - Visits list](images/web/visits-list.png)
![Placeholder - Visit detail](images/web/visit-detail.png)

---

## 8) Sales

- Period-based sales views (daily / weekly / monthly where offered).
- Align exports with the same filters you use on screen.

![Placeholder - Sales](images/web/sales.png)

---

## 9) Track team

- Map and list of **location reports** from officers’ devices (within configured working hours and permissions).
- Supervisors are typically scoped to their **department**; admins see broader views where configured.

![Placeholder - Team tracking](images/web/team-tracking.png)

---

## 10) Maintenance (vehicle incidents)

- **Open incidents** vs **Records** (completed or rejected).
- **Officer:** submit **Report breakdown** (vehicle type, description, **browser location** when the browser allows GPS).
- **Supervisor:** from **Reported** — **Verify breakdown** or **Reject**. Verification **does not** capture the supervisor’s GPS (desktop-safe). Optional **Supervisor notes**.
- **Officer:** after verification, **Report fixing / at garage** (uses GPS for the garage step on web when available).
- **Supervisor:** from **At garage** — **Acknowledge issue** or **Reject**.

Statuses in the UI follow: *Reported* → *Verified breakdown* → *Repair reported* (at garage) → *Acknowledged* (released) or *Rejected*.

![Placeholder - Maintenance](images/web/maintenance.png)

---

## 11) Reports and exports

- Use table and chart export actions where the product provides them.
- Confirm date range and filters before exporting so the file matches what you expect.

![Placeholder - Report export options](images/web/report-exports.png)

---

## 12) Related documents

- [Mobile User Manual](Mobile-User-Manual) — field app for officers.
- [Role-Based SOPs](Role-Based-SOPs) — who does what in the lifecycle.
- [Maintenance Control Module](Maintenance-Control-Module) — detailed incident lifecycle.
