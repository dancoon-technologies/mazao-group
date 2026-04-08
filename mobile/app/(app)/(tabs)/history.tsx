import { ListItemRow } from '@/components/ListItemRow';
import { useAuth } from '@/contexts/AuthContext';
import { getFarmers, getVisitsForOfficer, getAllVisits } from '@/database';
import { formatDateTime, visitStatusColor, visitStatusLabel } from '@/lib/format';
import { farmerRowToFarmer, visitRowToVisit } from '@/lib/offline-helpers';
import { api, type Farmer, type Visit } from '@/lib/api';
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
  const { userId, role } = useAuth();
  const isSupervisor = role === 'supervisor';
  const [visits, setVisits] = useState<Visit[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getFarmers();
        if (cancelled) return;
        setFarmers(rows.map(farmerRowToFarmer));
      } catch {
        if (!cancelled) setFarmers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const farmerById = useCallback(() => {
    const m: Record<string, Farmer> = {};
    for (const f of farmers) m[f.id] = f;
    return m;
  }, [farmers]);

  const loadFromDb = useCallback(async () => {
    if (!userId && !isSupervisor) return;
    const rows = isSupervisor ? await getAllVisits() : await getVisitsForOfficer(userId!);
    setVisits(rows.map(visitRowToVisit));
    setError(null);
    setForbidden(false);
  }, [userId, isSupervisor]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    setError(null);
    setForbidden(false);
    if (userId || isSupervisor) {
      await loadFromDb();
    }
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
        } else if (userId || isSupervisor) {
          await loadFromDb();
        } else {
          setError(msg);
        }
      }
    } else if (userId || isSupervisor) {
      await loadFromDb();
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId, isSupervisor, loadFromDb]);

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
      const farmerMap = farmerById();
      const farmer = farmerMap[v.farmer];
      const partnerType =
        v.partner_is_stockist != null
          ? v.partner_is_stockist
            ? 'Stockist'
            : 'Farmer'
          : farmer
            ? farmer.is_stockist
              ? 'Stockist'
              : 'Farmer'
            : null;
      const farmerName = v.farmer_display_name ?? farmer?.display_name ?? v.farmer ?? 'Unknown';
      const subtitle = [activityLabel, formatDateTime(v.created_at)].filter(Boolean).join(' · ');
      return (
        <ListItemRow
          avatarLetter={farmerName.toString()}
          title={partnerType ? `${farmerName} · ${partnerType}` : farmerName}
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
    [openVisit, farmerById]
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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <Text variant="bodyMedium">You don&apos;t have permission to view visit history.</Text>
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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
  safe: { flex: 1},
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
