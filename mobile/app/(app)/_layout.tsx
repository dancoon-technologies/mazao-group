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
import { clearTrackingSessionStart, markTrackingSessionStart, startTracking, stopTracking } from '@/lib/trackingCollector';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { Drawer } from 'expo-router/drawer';
import { useRouter } from 'expo-router';
import { DrawerContentScrollView, DrawerItem, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { AppState, Alert, Pressable, StyleSheet, Text, View, type AppStateStatus } from 'react-native';

function AppDrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter();
  const { role, logout, displayName, email } = useAuth();
  const isSupervisor = role === 'supervisor' || role === 'admin';

  const go = (path: string) => {
    props.navigation.closeDrawer();
    router.push(path as never);
  };

  const handleLogout = () => {
    props.navigation.closeDrawer();
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  return (
    <DrawerContentScrollView {...props}>
      <Pressable onPress={() => go('/(app)/(tabs)/profile')} style={drawerStyles.profileHeader}>
        <View style={drawerStyles.avatar}>
          <Text style={drawerStyles.avatarText}>
            {(displayName?.trim() || email || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={drawerStyles.profileTextWrap}>
          <Text style={drawerStyles.profileTitle}>{displayName?.trim() || 'Profile'}</Text>
          <Text style={drawerStyles.profileSubtitle} numberOfLines={1}>
            {email || 'View profile'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#6B7280" />
      </Pressable>
      <DrawerItem
        label="Home"
        icon={({ size, color }) => <MaterialCommunityIcons name="home" size={size} color={color} />}
        onPress={() => go('/(app)/(tabs)')}
      />
      <DrawerItem
        label="Visits"
        icon={({ size, color }) => <MaterialCommunityIcons name="format-list-bulleted" size={size} color={color} />}
        onPress={() => go('/(app)/(tabs)/visits')}
      />
      <DrawerItem
        label="Schedules"
        icon={({ size, color }) => <MaterialCommunityIcons name="calendar" size={size} color={color} />}
        onPress={() => go('/(app)/(tabs)/schedules')}
      />
      <DrawerItem
        label="Farmers"
        icon={({ size, color }) => <MaterialCommunityIcons name="account-group" size={size} color={color} />}
        onPress={() => go('/(app)/(tabs)/farmers')}
      />
      <DrawerItem
        label="Stockists"
        icon={({ size, color }) => <MaterialCommunityIcons name="store-outline" size={size} color={color} />}
        onPress={() => go('/(app)/(tabs)/stockists')}
      />
      <DrawerItem
        label="History"
        icon={({ size, color }) => <MaterialCommunityIcons name="history" size={size} color={color} />}
        onPress={() => go('/(app)/(tabs)/history')}
      />
      {isSupervisor ? (
        <DrawerItem
          label="Track team"
          icon={({ size, color }) => <MaterialCommunityIcons name="map-marker-path" size={size} color={color} />}
          onPress={() => go('/(app)/(tabs)/tracking')}
        />
      ) : null}
      <DrawerItem
        label="Report incident"
        icon={({ size, color }) => <MaterialCommunityIcons name="tools" size={size} color={color} />}
        onPress={() => go('/(app)/(tabs)/maintenance')}
      />
      <DrawerItem
        label="Change password"
        icon={({ size, color }) => <MaterialCommunityIcons name="lock-reset" size={size} color={color} />}
        onPress={() => go('/change-password')}
      />
      <DrawerItem
        label="Logout"
        icon={({ size, color }) => <MaterialCommunityIcons name="logout" size={size} color={color} />}
        onPress={handleLogout}
      />
    </DrawerContentScrollView>
  );
}

const drawerStyles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1B8F3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  profileTextWrap: { flex: 1, marginLeft: 10, marginRight: 6 },
  profileTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  profileSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});

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

  // Location tracking during working hours (silent startup to avoid permission prompt at sign-in)
  useEffect(() => {
    if (!isAuthenticated) {
      clearTrackingSessionStart().catch(() => {});
      stopTracking();
      return;
    }
    markTrackingSessionStart().catch(() => {});
    let cancelled = false;
    api.getOptions().then((o) => {
      if (!cancelled) {
        appMeta$.cachedOptions.set(o);
        if (o?.tracking_settings) startTracking(o.tracking_settings, { requestPermissions: false });
        else startTracking(undefined, { requestPermissions: false });
        api.getAccessToken().then((t) => {
          if (t) refreshDeviceClockOffset(t);
        });
      }
    }).catch(() => {
      if (!cancelled) {
        const cached = appMeta$.cachedOptions.get();
        if (cached?.tracking_settings) startTracking(cached.tracking_settings, { requestPermissions: false });
        else startTracking(undefined, { requestPermissions: false });
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
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/index" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/visits" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/schedules" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/farmers" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/stockists" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/history" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/tracking" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/profile" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/maintenance" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="(tabs)/menu" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="unlock" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="record-visit" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="add-farmer" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="propose-schedule" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="edit-schedule/[id]" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="weekly-plan" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="route-form" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="route-report" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="notifications" options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}

export default function AppLayout() {
  return (
    <AppRefreshProvider>
      <AppLayoutInner />
    </AppRefreshProvider>
  );
}
