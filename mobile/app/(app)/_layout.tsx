import { useAuth } from '@/contexts/AuthContext';
import { syncWithServer } from '@/lib/syncWithServer';
import { Stack, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      if (online && wasOffline.current === true) {
        syncWithServer().catch(() => {});
      }
      wasOffline.current = !online;
    });
    return () => sub();
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
