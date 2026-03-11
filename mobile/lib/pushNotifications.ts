/**
 * Register for push notifications and send Expo push token to backend.
 * Call after login when user is authenticated.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

/** projectId is required for Expo push tokens. Set in app.json extra.eas.projectId (or EAS config). */
function getProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

// Show notifications when app is in foreground. Wrap in try/catch so native module init failure doesn't crash the app.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {
  // Native notifications module may not be ready yet (e.g. on some devices/emulators)
}

export type PushRegistrationResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  try {
    if (!Device.isDevice) {
      logger.info('Push notifications require a physical device');
      return { ok: false, error: 'Use a physical device (not an emulator).' };
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      if (finalStatus !== 'granted') {
        logger.info('Push permission not granted');
        return { ok: false, error: 'Notification permission denied. Enable in device Settings → Apps → Notifications.' };
      }
    }

    const projectId = getProjectId();
    if (!projectId) {
      logger.warn('Expo projectId not found; push tokens require extra.eas.projectId in app config');
      return { ok: false, error: 'App config missing projectId. Rebuild the app with EAS.' };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData?.data ?? null;
    if (!token || typeof token !== 'string') {
      logger.warn('Could not get Expo push token');
      return { ok: false, error: 'Could not get push token. Try again or use a production build.' };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    try {
      await api.registerPushToken(token, Device.modelName ?? undefined);
      logger.info('Push token registered with backend');
      return { ok: true, token };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('Failed to register push token with backend', msg);
      return { ok: false, error: `Server: ${msg}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('Push registration failed', msg);
    return { ok: false, error: msg };
  }
}
