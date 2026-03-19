import { AppRefreshProvider, useAppRefresh } from '@/contexts/AppRefreshContext';
import { useAuth } from '@/contexts/AuthContext';
import { appMeta$ } from '@/store/observable';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import { scheduleRouteReportReminders } from '@/lib/routeReportReminder';
import { registerBackgroundSyncTask } from '@/lib/backgroundSync';
import { api } from '@/lib/api';
import { refreshDeviceClockOffset } from '@/lib/deviceClockSync';
import { navigateFromNotificationPayload } from '@/lib/notificationNavigation';
import { getLastSync, syncWithServer } from '@/lib/syncWithServer';
import { startTracking, stopTracking } from '@/lib/trackingCollector';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

function AppLayoutInner() {
  const router = useRouter();
  const { isAuthenticated, isLoading, role } = useAuth();
  const { triggerRefresh } = useAppRefresh();
  const wasOffline = useRef<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Hydrate "Last synced" from SecureStore so UI shows previous session's sync time
  useEffect(() => {
    if (!isAuthenticated) return;
    getLastSync().then((iso) => {
      if (iso) appMeta$.lastSyncAt.set(iso);
    });
  }, [isAuthenticated]);

  // Register background sync so offline data is pushed when app is in background
  useEffect(() => {
    if (!isAuthenticated) return;
    registerBackgroundSyncTask().catch(() => {});
  }, [isAuthenticated]);

  // Run sync immediately on mount when online (avoid stale store when user goes offline later)
  useEffect(() => {
    if (!isAuthenticated) return;
    NetInfo.fetch().then((state) => {
      if (state.isConnected ?? false) {
        syncWithServer().then(() => triggerRefresh()).catch(() => { });
      }
      wasOffline.current = !(state.isConnected ?? false);
    });
  }, [isAuthenticated, triggerRefresh]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      if (online && (wasOffline.current === true || wasOffline.current === null)) {
        syncWithServer().then(() => triggerRefresh()).catch(() => { });
      }
      wasOffline.current = !online;
    });
    return () => sub();
  }, [isAuthenticated, triggerRefresh]);

  // When app returns to foreground (e.g. after unlock): sync when online then always trigger so Home/Visits refetch (or reload from store when offline)
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleAppState = (next: AppStateStatus) => {
      if (next !== 'active') return;
      NetInfo.fetch().then((state) => {
        if (state.isConnected ?? false) {
          syncWithServer().then(() => triggerRefresh()).catch(() => triggerRefresh());
        } else {
          triggerRefresh();
        }
      });
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isAuthenticated, triggerRefresh]);

  // Auto sync: run sync periodically when app is active so data stays fresh without manual refresh
  const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minute
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      NetInfo.fetch().then((state) => {
        if (state.isConnected ?? false) {
          syncWithServer().then(() => triggerRefresh()).catch(() => {});
        }
      });
    }, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated, triggerRefresh]);

  // Location tracking during working hours (config from admin; use cache when offline)
  useEffect(() => {
    if (!isAuthenticated) {
      stopTracking();
      return;
    }
    let cancelled = false;
    api.getOptions().then((o) => {
      if (!cancelled) {
        appMeta$.cachedOptions.set(o);
        if (o?.tracking_settings) startTracking(o.tracking_settings);
        else startTracking();
        api.getAccessToken().then((t) => {
          if (t) refreshDeviceClockOffset(t);
        });
      }
    }).catch(() => {
      if (!cancelled) {
        const cached = appMeta$.cachedOptions.get();
        if (cached?.tracking_settings) startTracking(cached.tracking_settings);
        else startTracking();
        api.getAccessToken().then((t) => {
          if (t) refreshDeviceClockOffset(t);
        });
      }
    });
    return () => {
      cancelled = true;
      stopTracking();
    };
  }, [isAuthenticated]);

  // Register for push notifications when authenticated (defer slightly so native module is ready)
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(() => {
      registerForPushNotificationsAsync().catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  // Schedule 6 PM route report reminders for officers
  useEffect(() => {
    if (!isAuthenticated || role !== 'officer') return;
    const t = setTimeout(() => scheduleRouteReportReminders().catch(() => {}), 1000);
    return () => clearTimeout(t);
  }, [isAuthenticated, role]);

  // Retry push registration when app returns to foreground (e.g. user was offline at login)
  const lastPushRegRef = useRef<number>(0);
  const PUSH_REG_THROTTLE_MS = 60_000;
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleAppState = (next: AppStateStatus) => {
      if (next !== 'active') return;
      const now = Date.now();
      if (now - lastPushRegRef.current < PUSH_REG_THROTTLE_MS) return;
      lastPushRegRef.current = now;
      registerForPushNotificationsAsync().catch(() => {});
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isAuthenticated]);

  // When user taps a push/local notification, open the target screen (data / action_data from backend)
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  useEffect(() => {
    try {
      notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        navigateFromNotificationPayload(router, data, {
          defaultWhenEmpty: '/(app)/notifications' as const,
        });
      });
    } catch {
      // Native notifications may be unavailable (e.g. emulator); avoid crash
    }
    return () => {
      try {
        notificationResponseListener.current?.remove();
      } catch {
        // ignore
      }
    };
  }, [router]);

  // Cold start: app opened from a notification tap (handle once per app launch after auth)
  const launchNotificationHandled = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || isLoading || launchNotificationHandled.current) return;
    launchNotificationHandled.current = true;
    let cancelled = false;
    (async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (cancelled || !response) return;
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        navigateFromNotificationPayload(router, data, {
          defaultWhenEmpty: '/(app)/notifications' as const,
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, router]);

  if (!isAuthenticated) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="unlock" />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="record-visit" options={{ title: 'Record visit' }} />
      <Stack.Screen name="add-farmer" options={{ title: 'Add farmer' }} />
      <Stack.Screen name="propose-schedule" options={{ title: 'Propose schedule' }} />
      <Stack.Screen name="edit-schedule/[id]" options={{ title: 'Edit schedule' }} />
      <Stack.Screen name="weekly-plan" options={{ title: 'Weekly plan' }} />
      <Stack.Screen name="route-form" options={{ title: 'Route' }} />
      <Stack.Screen name="route-report" options={{ title: 'Route report' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  );
}

export default function AppLayout() {
  return (
    <AppRefreshProvider>
      <AppLayoutInner />
    </AppRefreshProvider>
  );
}
