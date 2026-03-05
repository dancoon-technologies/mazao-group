import {
  ActionCard,
  EmptyStateCard,
  InfoCard,
  SectionHeader,
  StatCard,
} from '@/components/dashboard';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getAllSchedulesForOfficer } from '@/database';
import { farmerRowToFarmer, scheduleRowToSchedule } from '@/lib/offline-helpers';
import { api, type Farmer, type Schedule } from '@/lib/api';
import { router, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Card,
  Chip,
  Surface,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const STAT_ICONS = {
  today: 'clipboard-text-outline',
  month: 'chart-line',
  schedules: 'calendar-outline',
  farmers: 'account-group-outline',
} as const;

export default function HomeScreen() {
  const { email, department, userId } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [stats, setStats] = useState<{ visits_today: number; visits_this_month: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFromDb = useCallback(async () => {
    if (!userId) return;
    const { getFarmers } = await import('@/database');
    const [farmerRows, scheduleRows] = await Promise.all([
      getFarmers(),
      getAllSchedulesForOfficer(userId),
    ]);
    setFarmers(farmerRows.map(farmerRowToFarmer));
    setSchedules(scheduleRows.map(scheduleRowToSchedule));
    setStats(null);
    setError('');
  }, [userId]);

  const load = useCallback(async () => {
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected) {
      try {
        const [s, f, statsRes] = await Promise.all([
          api.getSchedules(),
          api.getFarmers(),
          api.getDashboardStats?.().catch(() => null),
        ]);
        setSchedules(Array.isArray(s) ? s : []);
        setFarmers(Array.isArray(f) ? f : []);
        setStats(statsRes ?? null);
        setError('');
      } catch (e) {
        if (userId) {
          await loadFromDb();
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
      }
    } else if (userId) {
      await loadFromDb();
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId, loadFromDb]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todaySchedules = schedules.filter((s) => s.scheduled_date === today);
  const pendingProposals = schedules
    .filter((s) => s.status === 'proposed')
    .sort((a, b) => (a.scheduled_date > b.scheduled_date ? 1 : -1));
  const recentFarmers = farmers.slice(0, 5);
  const visitsToday = stats?.visits_today ?? 0;
  const visitsThisMonth = stats?.visits_this_month ?? 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Surface style={styles.centered} elevation={0}>
          <ActivityIndicator size="large" />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading dashboard…
          </Text>
        </Surface>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcome}>
          <Text variant="bodyLarge" style={styles.welcomeEmail}>
            {email ?? 'Field officer'}
          </Text>
          {department ? (
            <Chip style={styles.tag} textStyle={styles.tagText}>
              {department}
            </Chip>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <ActionCard
            icon="camera"
            label="Record Visit"
            variant="primary"
            onPress={() => router.push('/(app)/record-visit')}
          />
          <ActionCard
            icon="account-plus"
            label="Add Farmer"
            onPress={() => router.push('/(app)/add-farmer')}
          />
          <ActionCard
            icon="calendar"
            label="Schedule"
            onPress={() => router.push('/(app)/propose-schedule')}
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard icon={STAT_ICONS.today} label="Today" value={visitsToday} />
          <StatCard icon={STAT_ICONS.month} label="This Month" value={visitsThisMonth} />
          <StatCard icon={STAT_ICONS.schedules} label="Schedules" value={schedules.length} />
          <StatCard icon={STAT_ICONS.farmers} label="Farmers" value={farmers.length} />
        </View>

        <SectionHeader title="Pending (my proposals)" />
        {pendingProposals.length === 0 ? (
          <EmptyStateCard message="No pending proposals. Propose a schedule to see it here." />
        ) : (
          pendingProposals.map((s) => (
            <InfoCard
              key={s.id}
              title={s.farmer_display_name ?? 'No farmer assigned'}
              subtitle={`${formatDate(s.scheduled_date)} · Awaiting approval`}
              right={
                <Chip style={styles.pendingChip} textStyle={styles.pendingChipText} compact>
                  Pending
                </Chip>
              }
              onPress={() =>
                s.farmer
                  ? router.push({ pathname: '/(app)/record-visit', params: { farmerId: s.farmer } })
                  : router.push('/(app)/record-visit')
              }
            />
          ))
        )}

        <SectionHeader title="Today's Schedule" />
        {todaySchedules.length === 0 ? (
          <EmptyStateCard message="No visits scheduled for today" />
        ) : (
          todaySchedules.map((s) => (
            <InfoCard
              key={s.id}
              title={s.farmer_display_name ?? 'No farmer assigned'}
              subtitle={s.notes || formatDate(s.scheduled_date)}
              right={
                <Chip style={styles.statusChip} textStyle={styles.statusChipText} compact>
                  {s.status}
                </Chip>
              }
              onPress={() =>
                s.farmer
                  ? router.push({ pathname: '/(app)/record-visit', params: { farmerId: s.farmer } })
                  : router.push('/(app)/record-visit')
              }
            />
          ))
        )}

        <SectionHeader
          title="Recent Farmers"
          rightLabel="View all"
          onRightPress={() => router.push('/(app)/(tabs)/farmers')}
        />
        {recentFarmers.length === 0 ? (
          <EmptyStateCard message="No farmers yet" />
        ) : (
          recentFarmers.map((f) => (
            <InfoCard
              key={f.id}
              title={f.display_name}
              subtitle={f.phone || '—'}
              onPress={() => router.push('/(app)/(tabs)/farmers')}
            />
          ))
        )}

        {error ? (
          <Card style={styles.errorCard} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.errorText}>{error}</Text>
            </Card.Content>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 100 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 16 },
  welcome: { marginBottom: spacing.xl },
  welcomeEmail: { marginTop: 0, color: colors.gray700 },
  tag: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
  },
  tagText: { color: colors.primary, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statusChip: { backgroundColor: colors.primaryLight },
  statusChipText: { color: colors.primary, fontSize: 12 },
  pendingChip: { backgroundColor: colors.gray200 },
  pendingChipText: { color: colors.gray700, fontSize: 12 },
  errorCard: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.error },
  errorText: { color: colors.error },
});
