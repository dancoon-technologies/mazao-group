# Mazao Mobile (Extension Officers)

React Native (Expo) app for extension officers to record farmer visits with photo proof and location.

## Features

- **Login** with email and password (same backend as web).
- **Second authentication**: Unlock the app with fingerprint or Face ID. Required when opening the app or returning from background.
- **Home**: View today’s schedules and assigned farmers.
- **Record visit**: Select farmer → take photo with camera → submit with GPS location as proof. Backend verifies distance to farmer (< 100 m).

## Setup

1. **Backend**: Run the Django API (see repo root). Ensure it is reachable from your device/emulator.

2. **API URL**: Set the backend URL for the app.
   - Create `.env` in `mobile/` with:
     ```env
     EXPO_PUBLIC_API_URL=http://YOUR_IP:8000/api
     ```
   - On device: use your machine’s LAN IP (e.g. `http://192.168.1.10:8000/api`), not `localhost`.
   - For Android emulator, use `http://10.0.2.2:8000/api`.

3. **CORS**: If the app hits the API from a different origin, ensure Django `CORS_ALLOWED_ORIGINS` includes your Expo dev URL or use a tunnel.

4. **Install and run**:
   ```bash
   cd mobile
   pnpm install
   pnpm start
   ```
   Then scan QR with Expo Go (Android/iOS) or run `pnpm android` / `pnpm ios`.

## Permissions

- **Camera**: To take proof-of-visit photos.
- **Location**: To send GPS with the visit (required by backend).
- **Biometrics**: To unlock the app (fingerprint / Face ID).

These are requested at runtime when needed.

## App icon and splash screen

Source files live under `assets/images/` (`icon.png`, `splash-icon.png`, `favicon.png`). The Android launcher uses **the same** `icon.png` as iOS (adaptive icon: foreground + white background in `app.json`). After you **replace** PNGs, the native launcher and splash do **not** update until the Android project is regenerated from `app.json`.

1. Update the images (1024×1024 for `icon.png`; splash icon typically centered on a transparent or solid background — see [Expo splash & icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)).
2. From `mobile/`, sync native Android resources: `npm run sync:android` (or `npm run sync:android:clean` if icons/splash still look stale; this rewrites the `android/` folder).
3. Reinstall the app: `npm run android`. Expo Go and dev clients often show **cached** or **default** splash; use a release/preview build to verify the real launch screen.

On iOS, if you add an `ios/` project later, use `npm run ios:rebuild` to avoid a cached launch screen after asset changes.

### Sentry and release builds

Gradle runs a Sentry step to upload JS source maps. Without `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`, that step fails. Preview/production profiles in `eas.json` set `SENTRY_DISABLE_AUTO_UPLOAD=true` so CI and local EAS builds succeed. To enable uploads, add the Sentry env vars (e.g. in EAS Secrets or your CI) and remove or set `SENTRY_DISABLE_AUTO_UPLOAD` to `false`.
