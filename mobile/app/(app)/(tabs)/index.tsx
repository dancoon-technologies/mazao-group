import {
  ActionCard,
  EmptyStateCard,
  SectionHeader,
  StatCard,
} from '@/components/dashboard';
import { ListItemRow } from '@/components/ListItemRow';
import { cardShadow, cardStyle, colors, radius, spacing } from '@/constants/theme';
import { useAppRefresh } from '@/contexts/AppRefreshContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Farmer, type Schedule } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { farmerRowToFarmer, scheduleRowToSchedule } from '@/lib/offline-helpers';
import { syncWithServer } from '@/lib/syncWithServer';
import { appMeta$, farmers$, schedules$, visits$ } from '@/store/observable';
import { observer, useSelector } from '@legendapp/state/react';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const STAT_ICONS = {
  today: 'clipboard-text-outline',
  month: 'chart-line',
  schedules: 'calendar-outline',
  farmers: 'account-group-outline',
} as const;

function HomeScreenInner() {
  const routerInstance = useRouter();
  const { email, department, userId, displayName } = useAuth();
  const { refreshTrigger } = useAppRefresh();
  const prevRefreshTrigger = useRef(0);
  const [stats, setStats] = useState<{ visits_today: number; visits_this_month: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  /** Reactive read from store — updates when rehydration or sync populates store. */
  const farmers = useSelector<Farmer[]>(() => {
    const list = farmers$.get() ?? [];
    return [...list]
      .sort((a, b) => (a.display_name || a.first_name).localeCompare(b.display_name || b.first_name))
      .map(farmerRowToFarmer);
  });
  const schedules = useSelector<Schedule[]>(() => {
    if (!userId) return [];
    const list = schedules$.get() ?? [];
    return list
      .filter((s) => s.officer === userId && s.is_deleted === 0)
      .sort((a, b) => b.scheduled_date - a.scheduled_date)
      .map(scheduleRowToSchedule);
  });
  const scheduleIdsWithRecordedVisits = useSelector<Set<string>>(() => {
    if (!userId) return new Set();
    const list = visits$.get() ?? [];
    const set = new Set<string>();
    for (const v of list) {
      if (v.officer === userId && v.is_deleted === 0 && v.schedule_id) set.add(v.schedule_id);
    }
    return set;
  });

  const farmerDisplayName = useCallback(
    (s: Schedule) =>
      s.farmer_display_name ?? farmers.find((f) => f.id === s.farmer)?.display_name ?? 'No farmer assigned',
    [farmers]
  );

  const load = useCallback(async (forceSync?: boolean) => {
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected && userId) {
      const lastSync = appMeta$.lastSyncAt.get();
      const skipSync =
        !forceSync &&
        lastSync &&
        Date.now() - new Date(lastSync).getTime() < 60_000;
      if (!skipSync) await syncWithServer().catch(() => { });
    }
    if (connected && userId) {
      try {
        const statsRes = await api.getDashboardStats?.().catch(() => null);
        setStats(statsRes ?? null);
        if (statsRes) appMeta$.cachedStats.set(statsRes);
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    } else if (userId) {
      const cached = appMeta$.cachedStats.get();
      if (cached) setStats(cached);
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch when app returns to foreground and sync completed (e.g. after unlock)
  useEffect(() => {
    if (refreshTrigger > 0 && refreshTrigger !== prevRefreshTrigger.current) {
      prevRefreshTrigger.current = refreshTrigger;
      load();
    }
  }, [refreshTrigger, load]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const openRecordVisit = useCallback(
    (s?: Schedule) => {
      if (s) {
        routerInstance.push({
          pathname: '/(app)/record-visit',
          params: { scheduleId: s.id, ...(s.farmer ? { farmerId: s.farmer } : {}) },
        });
      } else {
        routerInstance.push('/(app)/record-visit');
      }
    },
    [routerInstance]
  );
  const openAddFarmer = useCallback(() => routerInstance.push('/(app)/add-farmer'), [routerInstance]);
  const openProposeSchedule = useCallback(() => routerInstance.push('/(app)/propose-schedule'), [routerInstance]);

  const today = new Date().toISOString().slice(0, 10);
  const totalScheduledToday = schedules.filter(
    (s) => s.scheduled_date === today && s.status === 'accepted'
  ).length;
  const todaySchedules = schedules.filter(
    (s) =>
      s.scheduled_date === today &&
      s.status === 'accepted' &&
      !scheduleIdsWithRecordedVisits.has(s.id)
  );
  const doneToday = totalScheduledToday - todaySchedules.length;
  const visitsThisMonth = stats?.visits_this_month ?? 0;

  const todayLabel = String(doneToday);
  const todayHint = totalScheduledToday > 0 ? 'recorded of scheduled' : 'visits recorded today';

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
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
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcome}>
          <Text variant="bodyLarge" style={styles.welcomeGreeting}>{greeting}, </Text>
          <Text variant="bodyLarge" style={styles.welcomeEmail}>
            {displayName ?? email ?? 'Field officer'}
          </Text>
          {department ? (
            <Chip style={styles.tag} textStyle={styles.tagText}>
              {department}
            </Chip>
          ) : null}
          {(() => {
            const last = appMeta$.lastSyncAt.get();
            if (!last) return null;
            const mins = Math.round((Date.now() - new Date(last).getTime()) / 60000);
            const label = mins < 1 ? 'Just now' : mins === 1 ? '1 min ago' : `${mins} min ago`;
            return (
              <Text variant="bodySmall" style={styles.lastSync}>
                Last synced {label}
              </Text>
            );
          })()}
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.actionRow}>
            <ActionCard
              icon="camera"
              label="Record Visit"
              variant="primary"
              onPress={() => openRecordVisit()}
            />
            <ActionCard
              icon="account-plus"
              label="Add Farmer"
              onPress={openAddFarmer}
            />
            <ActionCard
              icon="calendar"
              label="Schedule"
              onPress={openProposeSchedule}
            />
          </View>

          <View style={styles.statsGrid}>
            <StatCard icon={STAT_ICONS.today} label="Today" value={todayLabel} hint={todayHint} />
            <StatCard icon={STAT_ICONS.month} label="This month" value={visitsThisMonth} hint="visits recorded" />
            <StatCard icon={STAT_ICONS.schedules} label="To do" value={todaySchedules.length} hint="visits left to record" />
            <StatCard icon={STAT_ICONS.farmers} label="Farmers" value={farmers.length} hint="in your list" />
          </View>

          <SectionHeader title="Today's Schedule" />
          {todaySchedules.length === 0 ? (
            <EmptyStateCard message="No visits scheduled for today" />
          ) : (
            todaySchedules.map((s) => (
              <ListItemRow
                key={s.id}
                avatarLetter={(farmerDisplayName(s) || '?').charAt(0)}
                title={farmerDisplayName(s)}
                subtitle={s.notes || formatDate(s.scheduled_date)}
                right={
                  <Chip style={styles.statusChip} textStyle={styles.statusChipText} compact>
                    {s.status}
                  </Chip>
                }
                onPress={() => openRecordVisit(s)}
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.backgroundWelcome },
  content: { padding: 0, flexGrow: 1 },
  contentContainer: { flex: 1, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.accentLight, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, overflow: 'hidden', minHeight: 0 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 16 },
  welcome: { padding: spacing.lg, paddingTop: spacing.xs, marginBottom: spacing.xs },
  lastSync: { marginTop: 6, color: colors.gray500 },
  welcomeEmail: { marginTop: 0, color: colors.gray700 },
  welcomeGreeting: { marginTop: 0, color: colors.gray700, fontWeight: '800', fontSize: 24},
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
  errorCard: { ...cardStyle, ...cardShadow, marginTop: spacing.md, borderColor: colors.error },
  errorText: { color: colors.error },
});

export default observer(HomeScreenInner);
