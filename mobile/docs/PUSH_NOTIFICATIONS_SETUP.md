# Push notifications setup (Android APK via GitHub Actions)

The app uses **Expo Push Notifications**. The APK is built with `eas build --platform android --profile preview --local` in GitHub Actions. For push to work on installed APKs, Android **FCM (Firebase Cloud Messaging)** credentials must be configured in your EAS project.

## Ensure FCM is configured for the workflow build

The workflow (`.github/workflows/build-android-apk.yml`) does **not** configure FCM by itself. It uses **EAS-managed credentials**: when the build runs, EAS CLI fetches the credentials (including FCM) for the **preview** profile and embeds them in the APK. You must set these up once:

| Step | What to do |
|------|------------|
| 1. **GitHub secret** | In the repo: **Settings → Secrets and variables → Actions**. Add a secret named `EXPO_TOKEN`. Create it at [expo.dev/accounts/[account]/settings/access-tokens](https://expo.dev/accounts) (classic token with “Read” and “Write” for the project). Without this, the build cannot fetch credentials. |
| 2. **EAS project** | Ensure the app is linked to an EAS project (e.g. `eas init` or `app.json` has `expo.extra.eas.projectId`). The workflow uses this project. |
| 3. **FCM for preview profile** | Run once (from your machine): `cd mobile` then `eas credentials --platform android`. Select the **preview** profile. Under **FCM (Push Notifications)** either **let EAS manage** (creates Firebase and FCM v1 for you) or **upload your own** FCM v1 service account JSON. |

After step 3, every APK built by the workflow (including from GitHub Actions) will include FCM credentials and can receive push notifications. No changes to the workflow file are required.

## One-time setup (detailed)

1. **Install EAS CLI** (if needed):
   ```bash
   npm install -g eas-cli
   ```

2. **Log in to Expo**:
   ```bash
   eas login
   ```

3. **Configure Android credentials for the project**:
   ```bash
   cd mobile
   eas credentials --platform android
   ```
   - Choose your project and the **preview** (or production) profile.
   - For **FCM (Push Notifications)**, either:
     - **Let EAS manage**: EAS can create a Firebase project and configure FCM v1 for you, or
     - **Upload your own**: if you already have a Firebase project, add the FCM v1 server key / service account as described in [Expo: Add Android FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/).

4. **GitHub Actions**: Add the `EXPO_TOKEN` secret (see table above). When the workflow runs `eas build --local`, EAS CLI uses this token to fetch the credentials (including FCM) from your EAS project and embeds them in the APK.

## How to know push is working

1. **Profile screen (in-app)**  
   Open the app on a **physical device**, log in, and go to **Profile**. Under **Push notifications** you’ll see:
   - **Status: Registered** — the app obtained an Expo push token and sent it to the backend. You can tap **Send test notification** to receive a test push on this device.
   - **Status: Not registered** — push isn’t set up yet (emulator, permission denied, missing FCM/projectId, or backend unreachable when the app registered).

2. **Send test from the app**  
   When status is **Registered**, tap **Send test notification**. Within a few seconds you should get a notification with title “Test notification”. If you see it (in foreground or background), push is working.

3. **Real events**  
   When a supervisor accepts or rejects a schedule, or a visit is verified, the backend sends a push to the officer. If those users have **Registered** on Profile and still don’t get pushes, check backend logs for Expo push errors.

4. **Expo Push Tool (optional)**  
   You can also send a test via [Expo Push Notifications tool](https://expo.dev/notifications). You need the device’s Expo push token (`ExponentPushToken[xxx]`). In development, the app logs “Push token registered with backend” after login; the backend stores the token. To get the token for the tool you can temporarily log it in `lib/pushNotifications.ts` after `getExpoPushTokenAsync`, or add a debug screen that displays it.

## Verify setup

- **projectId**: Already set in `app.json` under `expo.extra.eas.projectId`. It ties the Expo push token to your project.
- **Build**: After FCM is configured, the next APK built by the workflow will be able to receive push notifications on real devices.

## Troubleshooting: "Default FirebaseApp is not initialized"

If you see **"Default FirebaseApp is not initialized in this process ... Make sure to call FirebaseApp.initializeApp(Context) first"**:

1. **Android package must match `google-services.json`**  
   The app’s Android `applicationId` (in `android/app/build.gradle`) must match the `package_name` in your `google-services.json`. If you see a process name like `com.anonymous.mobile` in the error, the built app is using a different package than the one in `google-services.json` (e.g. `com.dancoon.mazaogroup`). Fix by aligning the native project with `app.json`: set `namespace` and `applicationId` in `android/app/build.gradle` to the same value as `expo.android.package` in `app.json`, and ensure your Kotlin/Java package and source folders match (e.g. `com/dancoon/mazaogroup/`).

2. **Include `google-services.json` and the Google Services plugin**  
   - In `app.json`: `expo.android.googleServicesFile` should point to your `google-services.json` (e.g. `"./google-services.json"`).  
   - The Android app module must apply the Google Services plugin and have `google-services.json` in the app directory (or the path configured) so Firebase is initialized. See [Expo: FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/).

3. **Rebuild the app**  
   After changing package name or Firebase config, do a clean native build (e.g. `eas build --platform android --profile preview --local --clear-cache` or regenerate `android/` with `npx expo prebuild --platform android --clean` then build again).

## References

- [Expo push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Add Android FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)
