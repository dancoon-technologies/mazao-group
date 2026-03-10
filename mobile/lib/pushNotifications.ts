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

// Show notifications when app is in foreground (optional: set to false to only show in background)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    logger.info('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    if (finalStatus !== 'granted') {
      logger.info('Push permission not granted');
      return null;
    }
  }

  const projectId = getProjectId();
  if (!projectId) {
    logger.warn('Expo projectId not found; push tokens require extra.eas.projectId in app config');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  const token = tokenData?.data ?? null;
  if (!token) {
    logger.warn('Could not get Expo push token');
    return null;
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
  } catch (e) {
    logger.warn('Failed to register push token with backend', e instanceof Error ? e.message : e);
  }

  return token;
}
