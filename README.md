# Mazao Group — Extension Officer Visit Monitoring System

**System design document**  
*Version 1.0 — single source of truth for architecture, data model, and functional design.*

---

## Executive summary

The system monitors **extension officers** (field staff) to **prevent ghost visits** by verifying that visits are recorded at the farmer’s location (GPS + photo). It supports **three roles** (Admin, Supervisor, Field officer) across **three departments** (Mazao na afya, Agritech, AgriPriize). The design is **demand-first**: client requirements drive the data model, use cases, and reporting. Delivered via a **mobile app** (field officers), **web app** (supervisors/admins), and a **shared backend API**.

---

## Table of contents

| § | Section |
|---|--------|
| 1 | [Introduction](#1-introduction) |
| 2 | [Requirements](#2-requirements) |
| 3 | [System overview & architecture](#3-system-overview--architecture) |
| 4 | [Data model](#4-data-model) |
| 5 | [Functional design](#5-functional-design) |
| 6 | [Cross-cutting design](#6-cross-cutting-design) |
| 7 | [Reporting design](#7-reporting-design) |
| 8 | [Glossary](#8-glossary) |
| 9 | [Out of scope & references](#9-out-of-scope--references) |

---

## 1. Introduction

### 1.1 Purpose

This document defines the **system design** for the Mazao extension officer visit monitoring system. It is the single source of truth for:

- Requirements (client demands)
- Architecture and components
- Data model (entities and relationships)
- Functional design (use cases, roles, system functions)
- Reporting and field-activity design

When client demands or scope change, requirements (§2) are updated first; the rest of the design is adjusted accordingly.

### 1.2 Problem statement

**Ghost visits** are visit records created when the officer was not physically at the farmer’s location (e.g. logged from office or home). The system must:

- Ensure visits are **verifiable** (GPS + photo, distance check).
- Give **supervisors and admins** visibility into real field activity.
- Support **planning** (schedules) and **reporting** aligned with client templates.

### 1.3 Scope

- **In scope:** User management (invite, deactivate, assign to department); visit recording with verification; farmer and farm (farming land) management; schedule proposal and approval; dashboards and visit lists; report outputs aligned with client templates.
- **Out of scope (initial):** See 9.

---

## 2. Requirements

Client demands drive the design. Below are the stated requirements.

### 2.1 Problem to solve

- **Monitor extension officers** and **prevent ghost visits** — i.e. ensure visits are real (officer physically at farmer’s location), not logged from elsewhere.

### 2.2 Organisation structure

- The organisation has **three departments**:
  1. **Mazao na afya**
  2. **Agritech**
  3. **AgriPriize**

Staff are assigned to exactly one department. Data access (farmers, visits, dashboards) is scoped by department and, where used, by region.

### 2.3 Roles and responsibilities (client demand)

| Role | Client demand |
|------|----------------|
| **Admin** | Invite users to the system; deactivate users; assign and reassign staff to a department. |
| **Supervisor** | View scoped insights and dashboard; view visits; accept schedule proposals from field officers. |
| **Field officer** | Record a visit; add a farmer to the system if they do not exist. |

---

## 3. System overview & architecture

### 3.1 What we’re building

- A **visit monitoring and verification system** for extension (field) officers.
- **Anti-ghost:** GPS and photo at visit time; distance check against farmer’s/farm’s location (e.g. 100 m threshold).
- **Three roles, three departments** as in §2. Admins manage people and departments; supervisors see scoped dashboards and approve schedules; field officers record visits and add farmers (and their farming lands).
- **Clients:** Mobile app (field officers primary), web app (supervisors and admins), **shared backend API** (Django + DRF, JWT auth).

### 3.2 High-level architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────────┐
│  Mobile app     │     │  Web app        │     │  Backend (Django + DRF)     │
│  (Field officers│     │  (Supervisors,  │────▶│  - REST API                  │
│   primary)      │──▶ │   Admins)       │     │  - Auth (JWT)                 │
└─────────────────┘     └─────────────────┘     │  - Visits, Farmers, Farms,   │
                                                 │    Schedules, Dashboard     │
                                                 └──────────────┬──────────────┘
                                                                │
                                                 ┌──────────────▼──────────────┐
                                                 │  DB (e.g. PostgreSQL)       │
                                                 │  + Object storage (e.g. S3) │
                                                 │    for visit photos         │
                                                 └─────────────────────────────┘
```

- **Mobile:** Record visit, add farmer/farm, propose schedule.
- **Web:** Dashboard, visit lists, schedule approval, user/department management.
- **Backend:** Single API; access control by role and scope (department/region).

---

## 4. Data model

### 4.1 Entities overview

| Entity | Description | Key attributes |
|--------|-------------|----------------|
| **User** | Staff account (admin, supervisor, or field officer). | email, role, department, region, is_active |
| **Farmer** | Farmer (person); can have multiple farming lands; assigned to a field officer. | name, phone, assigned_officer |
| **Farm** | One piece of farming land belonging to a farmer (farmer can have more than one). | farmer, county, sub_county, village, lat/lon, plot_size, crop_type |
| **Visit** | One recorded visit by an officer to a farmer (optionally at a specific farm), with proof. | officer, farmer, farm (optional), lat/lon, photo, notes, distance_from_farmer, verification_status, activity_type, created_at |
| **Schedule** | Planned visit; can be proposed by officer and approved by supervisor. | officer, scheduled_date, farmer (optional), notes, status (proposed/accepted/rejected) |

### 4.2 Relationships

- **User** has many Farmers (assigned), Visits (created), Schedules (as officer or creator/approver).
- **Farmer** has many Farms (farming lands) and many Visits and Schedules.
- **Farm** belongs to one Farmer.
- **Visit** belongs to one User (officer) and one Farmer; optionally to one Farm (the plot visited). Distance verification uses the visit’s farm location, or the farmer’s nearest farm if no farm is selected.
- **Schedule** belongs to one officer; optional farmer; created/approved by supervisor or admin.

*Department and region on User drive scoping for supervisors (filter farmers, visits, dashboard).*

### 4.3 Report template → entity mapping

Client visit/farmer report fields are stored as follows:

| Client field | Entity | Required? |
|--------------|--------|-----------|
| County, Sub-County, Village | Farm | Yes |
| Farmer name, Farmer contact | Farmer | Yes |
| Geo location | Farm (plot location) + Visit (officer GPS at record time) | Yes |
| Plot size, Crop grown, Predominant crop | Farm | Optional |
| Stage of crop, Germination %, Survival rate, Pests/diseases, Order value, Harvest kgs, Farmers feedback, Notes, Photos | Visit | Per §7.1; photo required for verification |

**Design:** Farmer is person-only (name, contact, assigned_officer). A farmer can have **more than one Farm**. Visit optionally references one Farm (which plot was visited); distance check uses that farm or nearest. See §7 for full report and field-activity design.

---

## 5. Functional design

### 5.1 System functionalities

| # | Functionality | Owner | Description |
|---|---------------|--------|-------------|
| 1 | User & access management | Admin | Invite users, deactivate users, assign/reassign staff to department (and region). |
| 2 | Visit recording | Field officer | Record visit with GPS + photo; system validates proximity and sets verification status. |
| 3 | Farmer onboarding | Field officer | Add farmer and at least one farm (location, county, sub_county, village, plot size, crop) when they don’t exist. |
| 4 | Schedule proposal | Field officer | Propose visit schedule (date, optional farmer, notes) for supervisor approval. |
| 5 | Schedule approval | Supervisor | Accept or reject schedule proposals from field officers. |
| 6 | Insights & reporting | Supervisor, Admin | View dashboard and visit lists, scoped by role (department/region or organisation-wide). |
| 7 | Visit verification | System | Verify or reject each visit using GPS distance and required photo (anti-ghost). |

### 5.2 Use cases

| ID | Use case | Actor | Goal | Brief flow |
|----|----------|--------|------|------------|
| UC1 | Invite and assign user | Admin | Onboard staff and assign department. | Admin invites user → user sets password → Admin assigns department (and region) → user can log in. |
| UC2 | Deactivate user | Admin | Disable access without deleting data. | Admin deactivates user → user cannot log in; data retained. |
| UC3 | Record visit | Field officer | Log a real visit with proof. | Officer selects farmer (or adds new) → selects farm if applicable → captures GPS + photo → submits → system verifies or rejects by distance. |
| UC4 | Add farmer | Field officer | Register farmer and farming land(s). | Officer enters farmer (name, phone) and ≥1 farm (location, county, sub_county, village, plot size, crop) → saved; farmer assignable for visits. |
| UC5 | Propose schedule | Field officer | Request approval for a planned visit. | Officer creates schedule proposal (date, optional farmer, notes) → supervisor sees proposal. |
| UC6 | Accept/reject schedule | Supervisor | Approve or reject proposals. | Supervisor views pending proposals → accepts or rejects each → officer notified. |
| UC7 | View dashboard and visits | Supervisor, Admin | Monitor field activity within scope. | User opens dashboard → stats (visits today/month, active officers) and visit list → filter by officer, date. |

### 5.3 Roles (detailed)

- **Admin:** Invite users, deactivate users, assign/reassign department (and region). Organisation-wide access to all data.
- **Supervisor:** View scoped insights and dashboard; view visits (filter by officer, date); accept/reject schedule proposals. Data scoped by department and/or region.
- **Field officer:** Record visit (GPS + photo, optional farm); add farmer and farm(s) if not present. Sees only own assigned farmers and own visits/schedules.

### 5.4 Key user flows (summary)

1. **Admin:** Invite user → user sets password → assign department (and region) → can deactivate later.
2. **Field officer:** Open app → optionally propose schedule → go to farmer → record visit (select farmer/farm, GPS + photo) → if new farmer, add farmer + farm(s) first → system verifies or rejects by distance.
3. **Supervisor:** Log in to web → dashboard (scoped) → list visits (filter) → view schedule proposals → accept/reject.

---

## 6. Cross-cutting design

### 6.1 Anti–ghost-visit mechanisms

1. **GPS at record time** — Visit stores officer’s current latitude/longitude.
2. **Distance check** — Distance from officer to the visited farm (or farmer’s nearest farm) is computed; if beyond threshold (e.g. 100 m), visit is **rejected** (not stored as verified).
3. **Photo evidence** — Photo required when recording a visit; supports audit.
4. **Schedules** — Planned vs actual visits can be compared to spot anomalies.
5. **Scoped visibility** — Supervisors and admins see visit history and stats (e.g. repeated same coordinates).

Future: device trust, tamper hints, etc. can be added without changing this high-level design.

### 6.2 Organisation & departments

- **Departments:** Mazao na afya, Agritech, AgriPriize. Staff assigned to exactly one.
- **Region** (optional) used with department for scoping supervisor and admin views.
- **User** model: `department` (and optionally `region`); `is_active` for deactivation.

---

## 7. Reporting design

### 7.1 Visit / farmer report template (data fields)

Client fields are mapped to **Farmer**, **Farm**, or **Visit** as in §4.3. Visit carries optional: `crop_stage`, `germination_percent`, `survival_rate`, `pests_diseases`, `order_value`, `harvest_kgs`, `farmers_feedback`; and required photo(s). Farm holds county, sub_county, village, lat/lon, plot_size, crop_type (or predominant_crop).

### 7.2 Field activity types

Each visit is tagged with a **field activity type** (enum or lookup). Client list:

| Code | Activity type (client label) |
|------|-------------------------------|
| order_collection | Order collection |
| debt_collections | Debt collections |
| account_opening | Account opening |
| farm_to_farm_visits | Farm to farm visits |
| key_farm_visits | Key farm visits |
| group_training | Group training |
| common_interest_group_training | Common Interest Group training |
| stakeholder_group_training | Stakeholder group training |
| exhibition | Exhibition |
| market_day_activation | Market day activation |
| market_survey | Market survey |
| competition_intelligence | Competition intelligence gathering |
| reporting | Reporting |
| demo_set_up | Demo set up |
| spot_demo | Spot demo |
| demo_site_training | Demo site training |
| stakeholder_engagement | Stakeholder engagement |
| farmers_cooperative_engagement | Farmers Cooperative society engagement |
| stockists_activation | Stockists activation |
| merchandising | Merchandising |
| route_storming | Route storming |
| farming_pocket_storming | Farming pocket storming |
| counter_staff_training | Counter staff training |
| counter_staff_bonding | Counter staff bonding session |
| key_farmers_bonding | Key Farmers bonding session / Goat eating sessions |

**Implementation:** Start with one `activity_type` per visit (Option A); optionally allow many-to-many (Option B) if client needs multiple tags per visit.

### 7.3 Report–farm relationship

A **report** is an **output** (screen or PDF/Excel), not a stored entity. It is built from **visits**.

- **Report → Visit:** Report lists/aggregates visits; each row/section = one visit.
- **Visit → Farm:** Visit optionally references one farm (plot visited); used for distance check and for showing which plot on the report.
- **Report → Farm (via Visit):** For each visit, the report shows that visit’s farm (county, sub_county, village, geo, plot size, crop). Farm appears only as the **plot visited** for that visit.

Exports (PDF/Excel) should follow the visit/farmer report template and include activity type and which farm was visited.

---

## 8. Glossary

| Term | Meaning |
|------|--------|
| **Ghost visit** | A visit record created when the officer was not physically at the farmer’s location. |
| **Extension officer** | Field staff who visit farmers; in the system, the **field officer** role. |
| **Farm** | One piece of farming land (plot) belonging to a farmer. A farmer can have more than one farm. |
| **Visit** | A single, verified or rejected record of a field officer meeting a farmer at a location, with proof (location, photo); optionally linked to a specific farm. |
| **Schedule** | A planned visit: who (officer), when (date), optionally which farmer; status e.g. proposed/accepted/rejected. |
| **Report** | An output (screen or PDF/Excel) built from visits; each visit can show farmer and farm visited (§7.3). |

---

## 9. Out of scope & references

### 9.1 Out of scope (initial design)

- Detailed invite email/SMS templates and flows.
- Offline-first mobile behaviour and sync rules.
- Advanced analytics (e.g. ML-based anomaly detection).
- Multi-tenant or multi-organisation support.

To be added in later iterations; document in this README or in ADRs.

### 9.2 Repository & documentation

| Area | Description |
|------|-------------|
| **Backend** | `backend/` — Django + DRF API. `backend/README.md`, `backend/docs/API.md` (setup, endpoints). |
| **Mobile** | `mobile/` — Field officer app (e.g. Expo/React Native). |
| **Web** | `web/` — Supervisor/Admin web app. |

- **API reference:** `backend/docs/API.md`
- **Deployment:** `backend/docs/DEPLOYMENT.md`
- **Backend layout, auth, GPS, testing:** `backend/docs/README.md`

### 9.3 Design decisions (alignment with codebase)

- **Role naming:** Backend uses `officer` for field role; product language “field officer” — same entity.
- **Departments:** User model to have `department` (and optionally `region`) for scoping.
- **Schedules:** Desired flow is field officer **proposes** → supervisor **accepts**. Schedule model: status (e.g. proposed/accepted/rejected), approver; API: propose and accept/reject endpoints.
- **Report templates:** Implement Farmer (person-only), Farm, Visit extensions and field-activity type per §4.3 and §7.
- **Multiple farming lands:** Model **Farm** entity (FK to Farmer); Visit optional FK to Farm for distance verification and reporting.

---

*This document is the single source of truth for system design. When client demands or scope change, update §2 first, then adjust the rest of the design accordingly.*
