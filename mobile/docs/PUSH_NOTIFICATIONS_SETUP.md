# Push notifications setup (Android APK via GitHub Actions)

The app uses **Expo Push Notifications**. The APK is built with `eas build --platform android --profile preview --local` in GitHub Actions. For push to work on installed APKs, Android **FCM (Firebase Cloud Messaging)** credentials must be configured in your EAS project.

## One-time setup

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

4. **GitHub Actions**: The workflow uses `EXPO_TOKEN` (secret). When the workflow runs `eas build --local`, EAS CLI uses this token to fetch the credentials (including FCM) from your EAS project and embeds them in the APK. No extra steps are needed in the workflow once credentials are set.

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

## References

- [Expo push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Add Android FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)
