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

## Verify

- **projectId**: Already set in `app.json` under `expo.extra.eas.projectId`. It ties the Expo push token to your project.
- **Build**: After FCM is configured, the next APK built by the workflow will be able to receive push notifications on real devices.
- **Test**: Install the APK on a physical device, log in, allow notifications when prompted. Use [Expo Push Notifications tool](https://expo.dev/notifications) to send a test notification to your device’s Expo push token (e.g. from the app logs or your backend).

## References

- [Expo push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Add Android FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)
