import { ListItemRow } from '@/components/ListItemRow';
import { useAuth } from '@/contexts/AuthContext';
import { getVisitsForOfficer } from '@/database';
import { formatDateTime, visitStatusColor, visitStatusLabel } from '@/lib/format';
import { visitRowToVisit } from '@/lib/offline-helpers';
import { api, type Visit } from '@/lib/api';
import { useFocusEffect, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Card, Text, Button } from 'react-native-paper';
import { colors, cardShadow, cardStyle, radius, spacing } from '@/constants/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const loadFromDb = useCallback(async () => {
    if (!userId) return;
    const rows = await getVisitsForOfficer(userId);
    setVisits(rows.map(visitRowToVisit));
    setError(null);
    setForbidden(false);
  }, [userId]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    setError(null);
    setForbidden(false);
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected) {
      try {
        const data = await api.getVisits();
        setVisits(Array.isArray(data) ? data : []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load';
        const isForbidden =
          msg.includes('403') ||
          msg.toLowerCase().includes('forbidden') ||
          msg.toLowerCase().includes('permission');
        if (isForbidden) {
          setForbidden(true);
          setVisits([]);
        } else if (userId) {
          await loadFromDb();
        } else {
          setError(msg);
        }
      }
    } else if (userId) {
      await loadFromDb();
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId, loadFromDb]);

  const onRefresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const openVisit = useCallback(
    (id: string) => router.push({ pathname: '/(app)/visits/[id]', params: { id } }),
    [router]
  );

  const renderVisitItem = useCallback(
    ({ item: v }: { item: Visit }) => {
      const status = v.verification_status || '';
      const activityLabel = (v.activity_type || '').replace(/_/g, ' ');
      const subtitle = [activityLabel, formatDateTime(v.created_at)].filter(Boolean).join(' · ');
      return (
        <ListItemRow
          avatarLetter={(v.farmer_display_name || v.farmer || '?').toString()}
          title={v.farmer_display_name ?? v.farmer ?? 'Unknown'}
          subtitle={subtitle}
          right={
            <View style={[styles.badge, { backgroundColor: visitStatusColor(status) + '20' }]}>
              {status.toLowerCase() === 'rejected' && (
                <MaterialCommunityIcons name="alert" size={14} color={visitStatusColor(status)} style={styles.badgeIcon} />
              )}
              <Text variant="labelSmall" style={[styles.badgeText, { color: visitStatusColor(status) }]}>
                {visitStatusLabel(status)}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={14} color={visitStatusColor(status)} />
            </View>
          }
          onPress={() => openVisit(v.id)}
        />
      );
    },
    [openVisit]
  );

  if (loading && visits.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (forbidden) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <Text variant="bodyMedium">Visit history is available to supervisors on the web app.</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Your recorded visits are saved on the server and visible to your supervisor.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.error}>{error}</Text>
            <Button onPress={() => load()}>Retry</Button>
          </Card.Content>
        </Card>
      </ScrollView>
      </SafeAreaView>
    );
  }

  if (visits.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <Text variant="bodyMedium">No visits yet</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Record a visit from the Visits tab or Dashboard.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={visits}
        keyExtractor={(item) => item.id}
        renderItem={renderVisitItem}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { ...cardStyle, ...cardShadow, marginBottom: spacing.md },
  muted: { marginTop: spacing.xs, opacity: 0.8 },
  error: { color: colors.error, marginBottom: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 2,
  },
  badgeIcon: { marginRight: 2 },
  badgeText: { fontWeight: '600', fontSize: 12 },
});
