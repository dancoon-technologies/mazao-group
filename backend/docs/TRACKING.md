# Location tracking and GPS accuracy

Location reports are collected by the mobile app during working hours and synced to the backend. The following optional enhancements improve accuracy and route consistency.

---

## Timestamp syncing

**Problem:** Device clocks can drift. Route ordering and time-based filters should use a consistent timeline.

**Solution:**

- Backend exposes **`GET /api/tracking/time/`** (auth required), returning server UTC in ISO 8601.
- Mobile fetches this when online (e.g. at sync time and when tracking starts), computes **device_clock_offset_seconds** = (device time − server time), and stores it.
- Each location report can include **`device_clock_offset_seconds`**. The backend then stores **`reported_at_server`** = `reported_at` − offset and uses it for **ordering** and listing. The web dashboard shows server-corrected time when present.

**Recommendation:** Keep backend time in sync with NTP so server UTC is authoritative.

---

## Device sensors (dead reckoning)

**Problem:** GPS is weak indoors or in urban canyons; fixes can be inaccurate or jumpy.

**Solution (optional):** The mobile app uses **accelerometer + gyroscope** (expo-sensors) when tracking is active. When a fix has **accuracy > 50 m**, the app uses **dead reckoning** from the last known good position and sensor integration to estimate position instead of trusting the poor GPS fix. This reduces jumpiness; the reported **accuracy** value is still the original (poor) one so the backend/dashboard can reflect uncertainty.

**Note:** Dead reckoning drifts over time; it is only used when the current fix is already poor and a recent good fix exists.

---

## Differential GPS (DGPS)

**Differential GPS** (e.g. RTK, SBAS) can provide **sub‑meter accuracy** but is typically not available on consumer phones. External GPS receivers (e.g. Bluetooth DGPS/RTK modules) can supply high-accuracy coordinates.

**Current support:** The API accepts **latitude**, **longitude**, and **accuracy** (meters) from the mobile app. If a future mobile client or external device sends coordinates from a DGPS receiver, the backend will store them as-is. The **accuracy** field can be set to a small value (e.g. &lt; 1 m) to indicate high-accuracy sources. No backend change is required; the tracking map and reports already display the stored accuracy.

**Recommendation:** If you integrate an external high-accuracy receiver, send its coordinates and accuracy in the same report shape; optionally set **device_info** to identify the source (e.g. `"gps_source": "external_rtk"`).

---

## Tamper-resistant tracking (fraud detection)

The system uses **defense in depth** to improve trust in location data: device-side checks, speed validation, and server-side anomaly detection.

### Mobile (device integrity)

- **Speed check:** Between consecutive reports, the app computes speed (km/h). If it exceeds thresholds, it adds `high_speed` or `impossible_speed` to `integrity_flags` and sends `device_integrity` with each report.
- **Mock location (optional):** If the native module **react-native-turbo-mock-location-detector** is installed (Android), the app sets `mock_provider: true` when a mock location app is active.
- **Root/jailbreak (optional):** If **react-native-device-info** is installed, the app sets `rooted: true` when the device is rooted or jailbroken.
- **Payload:** Each report can include `device_integrity: { mock_provider, rooted, speed_kmh, integrity_flags }`. The backend stores this and uses it for logging and display.

### Backend (server-side fraud detection)

- **Impossible travel:** When saving a report, the server finds the chronologically previous report for the same user and computes speed. If speed ≥ 150 km/h, it sets `integrity_warning = "impossible_travel"`.
- **Client flags:** If the client sent `mock_provider: true` or `integrity_flags` containing `"impossible_speed"`, the server sets `integrity_warning` to `"mock_provider"` or `"impossible_speed"`.
- **Storage:** `LocationReport` has optional `device_integrity` (JSON) and `integrity_warning` (string). The tracking dashboard shows the integrity column so admins can spot suspicious reports.

### Native modules in use

- **react-native-turbo-mock-location-detector** — Detects mock/fake GPS on Android and iOS 15+. Sets `mock_provider: true` when a mock location app is active.
- **jail-monkey** — Root (Android) and jailbreak (iOS) detection. Sets `rooted: true` when the device is rooted or jailbroken.

Both are dependencies of the mobile app; integrity checks run when each location report is enqueued. Backend impossible-travel and client high-speed flags remain active regardless.
