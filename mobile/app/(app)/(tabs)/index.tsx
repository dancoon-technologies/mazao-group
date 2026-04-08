import {
  ActionCard,
  EmptyStateCard,
  HomeHero,
  PrimaryVisitCta,
  SectionHeader,
  StatCard,
} from '@/components/dashboard';
import { ListItemRow } from '@/components/ListItemRow';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppRefresh } from '@/contexts/AppRefreshContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, getLabels, type Farmer, type Schedule } from '@/lib/api';
import { toLocalYmd } from '@/lib/dateLocal';
import { formatDate } from '@/lib/format';
import { farmerRowToFarmer, scheduleRowToSchedule } from '@/lib/offline-helpers';
import { syncWithServer } from '@/lib/syncWithServer';
import { appMeta$, farmers$, schedules$, visits$ } from '@/store/observable';
import { observer, useSelector } from '@legendapp/state/react';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Card,
  Chip,
  Surface,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const STAT_ICONS = {
  today: 'clipboard-text-outline',
  month: 'chart-line',
  schedules: 'calendar-outline',
  farmers: 'account-group-outline',
} as const;

function HomeScreenInner() {
  const insets = useSafeAreaInsets();
  const routerInstance = useRouter();
  const { email, department, userId, displayName, role } = useAuth();
  const isOfficer = role === 'officer';
  const isSupervisor = role === 'supervisor';
  const { refreshTrigger } = useAppRefresh();
  const prevRefreshTrigger = useRef(0);
  const [stats, setStats] = useState<{ visits_today: number; visits_this_month: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const labels = useSelector(() => getLabels(appMeta$.cachedOptions.get()));
  const lastSyncAt = useSelector(() => appMeta$.lastSyncAt.get());

  const syncLabel = useMemo(() => {
    if (!lastSyncAt) return null;
    const mins = Math.round((Date.now() - new Date(lastSyncAt).getTime()) / 60000);
    if (mins < 1) return 'Synced · Just now';
    if (mins === 1) return 'Synced · 1 min ago';
    return `Synced · ${mins} min ago`;
  }, [lastSyncAt, refreshTrigger]);

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
      .filter((s) => s.is_deleted === 0 && (isSupervisor || s.officer === userId))
      .sort((a, b) => b.scheduled_date - a.scheduled_date)
      .map(scheduleRowToSchedule);
  });
  const scheduleIdsWithRecordedVisits = useSelector<Set<string>>(() => {
    if (!userId) return new Set();
    const list = visits$.get() ?? [];
    const set = new Set<string>();
    for (const v of list) {
      if (v.is_deleted === 0 && v.schedule_id && (isSupervisor || v.officer === userId)) set.add(v.schedule_id);
    }
    return set;
  });

  const farmerDisplayName = useCallback(
    (s: Schedule) =>
      s.farmer_display_name ?? farmers.find((f) => f.id === s.farmer)?.display_name ?? `No ${labels.partner.toLowerCase()} assigned`,
    [farmers, labels.partner]
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
  const openAddStockist = useCallback(() => routerInstance.push({ pathname: '/(app)/add-farmer', params: { asStockist: '1' } }), [routerInstance]);
  const openProposeSchedule = useCallback(() => routerInstance.push('/(app)/propose-schedule'), [routerInstance]);
  const openMaintenance = useCallback(() => routerInstance.push('/(app)/(tabs)/maintenance' as never), [routerInstance]);

  const today = toLocalYmd(new Date());
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
  const todayHint =
    totalScheduledToday > 0
      ? isSupervisor
        ? 'team recorded of scheduled'
        : 'recorded of scheduled'
      : isSupervisor
        ? 'team visits recorded today'
        : 'visits recorded today';

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const heroName = displayName ?? email ?? (isSupervisor ? 'Supervisor' : 'Field officer');

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <StatusBar backgroundColor="#14532D" barStyle="light-content" />
        <View style={[styles.statusBarInset, { height: insets.top }]} />
        <LinearGradient
          colors={['#14532D', '#1B8F3A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.loadingCaption}>Loading dashboard…</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} >
      <StatusBar backgroundColor="#14532D" barStyle="light-content" />
      <View style={[styles.statusBarInset, { height: insets.top }]} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <HomeHero
          greeting={greeting}
          displayName={heroName}
          departmentLabel={department}
          syncLabel={syncLabel}
          onPressNotifications={() => routerInstance.push('/(app)/notifications' as never)}
        />

        <View style={styles.sheet}>
          {isOfficer ? <PrimaryVisitCta onPress={() => openRecordVisit()} /> : null}

          <Text style={styles.sectionEyebrow}>Quick actions</Text>
          <Text style={styles.sectionHint}>Shortcuts to common tasks</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actionsScroll}
          >
            <ActionCard icon="account-plus" label="Add farmer" onPress={openAddFarmer} />
            <ActionCard icon="store-outline" label="Add stockist" onPress={openAddStockist} />
            <ActionCard icon="calendar" label="Schedule" onPress={openProposeSchedule} />
            <ActionCard icon="tools" label="Report incidence" onPress={openMaintenance} />
          </ScrollView>

          <View style={styles.statsPanel}>
            <Text style={styles.sectionEyebrow}>At a glance</Text>
            <Text style={styles.sectionHint}>Numbers from your work</Text>
            <View style={styles.statsGrid}>
              <StatCard icon={STAT_ICONS.today} label="Today" value={todayLabel} hint={todayHint} />
              <StatCard icon={STAT_ICONS.month} label="This month" value={visitsThisMonth} hint="visits recorded" />
              <StatCard icon={STAT_ICONS.schedules} label="To do" value={todaySchedules.length} hint="visits left to record" />
              <StatCard icon={STAT_ICONS.farmers} label={`${labels.partner}s`} value={farmers.length} hint="in your list" />
            </View>
          </View>

          <SectionHeader title="Today's schedule" />
          {todaySchedules.length === 0 ? (
            <EmptyStateCard message={isSupervisor ? 'No team visits scheduled for today' : 'No visits scheduled for today'} />
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
                onPress={() => (isOfficer ? openRecordVisit(s) : routerInstance.push({ pathname: '/(app)/edit-schedule/[id]', params: { id: s.id } } as never))}
              />
            ))
          )}

          {error ? (
            <Card style={styles.errorCard} elevation={0}>
              <Card.Content>
                <Text style={styles.errorText}>{error}</Text>
              </Card.Content>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  statusBarInset: { backgroundColor: '#14532D' },
  container: { flex: 1, backgroundColor: colors.white },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 0,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
  },
  loadingCaption: {
    marginTop: spacing.lg,
    color: colors.gray900,
    fontSize: 16,
    fontWeight: '600',
  },
  sheet: {
    marginTop: -20,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.xl + 4,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 6,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.gray500,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  actionsScroll: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.xl,
    paddingRight: spacing.lg,
  },
  statsPanel: {
    backgroundColor: colors.gray100,
    borderRadius: radius.card + 4,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statusChip: { backgroundColor: colors.primaryLight },
  statusChipText: { color: colors.primary, fontSize: 12 },
  errorCard: {
    marginTop: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  errorText: { color: colors.error, fontSize: 15 },
});

export default observer(HomeScreenInner);
