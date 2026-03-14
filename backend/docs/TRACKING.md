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
