import { useAuth } from '@/contexts/AuthContext';
import { syncWithServer } from '@/lib/syncWithServer';
import { Stack, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export default function AppLayout() {
  const router = useRouter();
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();
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

  // Run sync immediately on mount when online (avoid stale SQLite when user goes offline later)
  useEffect(() => {
    if (!isAuthenticated) return;
    NetInfo.fetch().then((state) => {
      if (state.isConnected ?? false) syncWithServer().catch(() => {});
      wasOffline.current = !(state.isConnected ?? false);
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      if (online && (wasOffline.current === true || wasOffline.current === null)) {
        syncWithServer().catch(() => {});
      }
      wasOffline.current = !online;
    });
    return () => sub();
  }, [isAuthenticated]);

  // When app returns to foreground and we're online, run sync so pending queue is pushed
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleAppState = (next: AppStateStatus) => {
      if (next !== 'active') return;
      NetInfo.fetch().then((state) => {
        if (state.isConnected ?? false) syncWithServer().catch(() => {});
      });
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isAuthenticated]);

  if (!isAuthenticated || mustChangePassword) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="unlock" />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="record-visit" options={{ title: 'Record visit' }} />
      <Stack.Screen name="add-farmer" options={{ title: 'Add farmer' }} />
      <Stack.Screen name="propose-schedule" options={{ title: 'Propose schedule' }} />
    </Stack>
  );
}
