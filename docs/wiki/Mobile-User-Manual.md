# Mobile User Manual

This manual is written for field officers and supervisors using the mobile app.

## 1) Login and Security

1. Open app.
2. Enter email and password.
3. Complete unlock/security prompt when required.

![Placeholder - Login screen](images/mobile/login-screen.png)
![Placeholder - Unlock screen](images/mobile/unlock-screen.png)

## 2) Home Dashboard

- View quick actions and assigned work.
- Access core actions:
  - Record visit
  - Add farmer
  - Add stockist
  - Schedule
  - Maintenance

![Placeholder - Home dashboard](images/mobile/home-dashboard.png)

## 3) Record a Visit

1. Open **Record Visit**.
2. Select schedule/route or field visit path.
3. Select farmer/stockist and optional farm/outlet.
4. Select activity type(s).
5. Capture location and at least one photo.
6. Submit directly, or fill optional details then submit.

```mermaid
flowchart TD
  A[Open Record Visit] --> B[Select plan/partner/location]
  B --> C[Capture GPS]
  C --> D[Capture photo evidence]
  D --> E[Optional details]
  E --> F[Submit]
```

![Placeholder - Record Visit step 1](images/mobile/record-visit-step1.png)
![Placeholder - Record Visit step 2](images/mobile/record-visit-step2.png)

### Stockist Payment Tracking

- On stockist visits, enter **Stockist payment amount** in additional details when applicable.

![Placeholder - Stockist payment field](images/mobile/stockist-payment-field.png)

## 4) Farmers and Stockists

- Browse assigned records.
- Search by name/phone.
- Open detail pages.
- Add new farmer or stockist with location metadata.

![Placeholder - Farmers list](images/mobile/farmers-list.png)
![Placeholder - Add farmer form](images/mobile/add-farmer-form.png)

## 5) Schedules and Visits

- Propose schedules.
- View upcoming and history tabs.
- Track recorded vs pending work.

![Placeholder - Schedules tab](images/mobile/schedules-tab.png)
![Placeholder - Visits tab](images/mobile/visits-tab.png)

## 6) Tracking (Supervisor)

- Review team location updates.
- Inspect latest points and data quality hints.

![Placeholder - Tracking screen](images/mobile/tracking-screen.png)

## 7) Maintenance Control

### Officer Workflow

1. Open **Maintenance** tab.
2. Choose vehicle type.
3. Enter issue description.
4. Submit report with current GPS.

### Supervisor Workflow

1. Open incident.
2. Verify breakdown (captures GPS).
3. Mark at garage (captures GPS).
4. Approve or reject.

```mermaid
stateDiagram-v2
  [*] --> reported
  reported --> verified_breakdown
  verified_breakdown --> at_garage
  at_garage --> approved
  at_garage --> rejected
```

![Placeholder - Maintenance tab](images/mobile/maintenance-tab.png)
![Placeholder - Maintenance supervisor actions](images/mobile/maintenance-supervisor-actions.png)

## 8) Offline and Sync Behavior

- If offline, app stores eligible actions locally.
- Once online, sync retries automatically.
- Check profile/sync indicators for latest state.

![Placeholder - Offline banner](images/mobile/offline-banner.png)
![Placeholder - Sync status](images/mobile/sync-status.png)

## 9) Common Errors and What To Do

- **Location permission denied**
  - Enable location permission and retry.
- **Camera permission denied**
  - Enable camera permission in device settings.
- **Session expired**
  - Log in again and continue.
- **Validation error on submit**
  - Read message and fix missing/invalid fields.
