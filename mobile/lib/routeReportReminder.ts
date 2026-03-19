/**
 * Schedule local reminders at 6 PM and every 30 minutes after (6:00, 6:30, 7:00, 7:30, 8:00)
 * for the officer to fill the route report. Call when user (officer) is authenticated.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from '@/lib/logger';

const ROUTE_REPORT_CHANNEL_ID = 'route-report-reminder';
const NOTIFICATION_IDS = ['route-report-18-00', 'route-report-18-30', 'route-report-19-00', 'route-report-19-30', 'route-report-20-00'];

/** Hours and minutes for each reminder (24h). */
const REMINDER_TIMES = [
  { hour: 18, minute: 0 },
  { hour: 18, minute: 30 },
  { hour: 19, minute: 0 },
  { hour: 19, minute: 30 },
  { hour: 20, minute: 0 },
];

export async function scheduleRouteReportReminders(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ROUTE_REPORT_CHANNEL_ID, {
        name: 'Route report reminder',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    for (const id of NOTIFICATION_IDS) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }

    for (let i = 0; i < REMINDER_TIMES.length; i++) {
      const { hour, minute } = REMINDER_TIMES[i];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Route report',
          body: 'Time to fill your route report for today.',
          data: { screen: 'route-report' },
        },
        trigger: { hour, minute, repeats: true } as Notifications.NotificationTriggerInput,
        identifier: NOTIFICATION_IDS[i],
      });
    }
    logger.info('Route report reminders scheduled (6 PM and every 30 min until 8 PM)');
  } catch (e) {
    logger.warn('Failed to schedule route report reminders', e instanceof Error ? e.message : e);
  }
}

export async function cancelRouteReportReminders(): Promise<void> {
  for (const id of NOTIFICATION_IDS) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}
