import { AppRefreshProvider, useAppRefresh } from '@/contexts/AppRefreshContext';
import { useAuth } from '@/contexts/AuthContext';
import { appMeta$ } from '@/store/observable';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import { getLastSync, syncWithServer } from '@/lib/syncWithServer';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

function AppLayoutInner() {
  const router = useRouter();
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();
  const { triggerRefresh } = useAppRefresh();
  const wasOffline = useRef<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (mustChangePassword) {
      router.replace('/change-password');
    }
  }, [isAuthenticated, isLoading, mustChangePassword, router]);

  // Hydrate "Last synced" from SecureStore so UI shows previous session's sync time
  useEffect(() => {
    if (!isAuthenticated) return;
    getLastSync().then((iso) => {
      if (iso) appMeta$.lastSyncAt.set(iso);
    });
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

  // Register for push notifications when authenticated (defer slightly so native module is ready)
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(() => {
      registerForPushNotificationsAsync().catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  // When user taps a push notification, open the notifications screen
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  useEffect(() => {
    try {
      notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
        router.push('/(app)/notifications' as never);
      });
    } catch {
      // Native notifications may be unavailable (e.g. emulator); avoid crash
    }
    return () => {
      try {
        if (notificationResponseListener.current) {
          Notifications.removeNotificationSubscription(notificationResponseListener.current);
        }
      } catch {
        // ignore
      }
    };
  }, [router]);

  if (!isAuthenticated || mustChangePassword) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="unlock" />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="record-visit" options={{ title: 'Record visit' }} />
      <Stack.Screen name="add-farmer" options={{ title: 'Add farmer' }} />
      <Stack.Screen name="propose-schedule" options={{ title: 'Propose schedule' }} />
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
