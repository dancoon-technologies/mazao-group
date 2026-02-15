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
