"use client";

import { ListItemRow } from '@/components/ListItemRow';
import { useAuth } from '@/contexts/AuthContext';
import { colors, cardShadow, cardStyle, radius, spacing } from '@/constants/theme';
import { api, type Notification } from '@/lib/api';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Appbar, Button, Card, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatNotificationDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setList([]);
    if (!userId) {
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await api.getNotifications();
      setList(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load notifications';
      const isAuthError =
        msg.includes('Session expired') ||
        msg.includes('Not authenticated') ||
        msg.includes('Session') ||
        msg.toLowerCase().includes('401');
      setError(
        isAuthError
          ? 'Sign in when online to see notifications.'
          : msg
      );
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleMarkRead = useCallback(async (n: Notification) => {
    if (n.read_at) return;
    setMarkingId(n.id);
    try {
      await api.markNotificationRead(n.id);
      setList((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item
        )
      );
    } finally {
      setMarkingId(null);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    const unread = list.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    setMarkingId('all');
    try {
      await api.markAllNotificationsRead();
      const now = new Date().toISOString();
      setList((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    } finally {
      setMarkingId(null);
    }
  }, [list]);

  const safeList = list ?? [];
  const unreadCount = safeList.filter((n) => !n.read_at).length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Notifications" />
        {unreadCount > 0 && (
          <Appbar.Action
            icon="check-all"
            onPress={handleMarkAllRead}
            disabled={markingId === 'all'}
          />
        )}
      </Appbar.Header>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : error ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.error}>{error}</Text>
              <Button mode="outlined" onPress={load} style={styles.retryBtn}>
                Retry
              </Button>
            </Card.Content>
          </Card>
        ) : safeList.length === 0 ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.emptyText}>
                No notifications yet
              </Text>
              <Text variant="bodySmall" style={styles.emptySubtext}>
                You’ll see updates about schedules and visits here.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <View style={styles.list}>
            {safeList.map((n, index) => (
              <ListItemRow
                key={n?.id ?? `notif-${index}`}
                avatarLetter={((n?.title ?? '').charAt(0) || '?').toUpperCase()}
                title={n?.title ?? ''}
                subtitle={n?.message ?? ''}
                onPress={() => handleMarkRead(n)}
                right={
                  <View style={styles.rowRight}>
                    <Text variant="labelSmall" style={styles.time}>
                      {formatNotificationDate(n.created_at)}
                    </Text>
                    {!n.read_at && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray100 },
  appbar: { backgroundColor: colors.white, elevation: 0 },
  container: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: 80 },
  loader: { marginVertical: spacing.xl },
  card: { ...cardStyle, ...cardShadow },
  error: { marginBottom: 8 },
  retryBtn: { marginTop: 8 },
  emptyText: { color: colors.gray700 },
  emptySubtext: { color: colors.gray500, marginTop: 4 },
  list: { gap: 0 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  time: { color: colors.gray500 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
