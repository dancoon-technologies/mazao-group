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
import { api, getLabels, type Farmer, type Schedule } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { farmerRowToFarmer, scheduleRowToSchedule } from '@/lib/offline-helpers';
import { syncWithServer } from '@/lib/syncWithServer';
import { appMeta$, farmers$, schedules$, visits$ } from '@/store/observable';
import { observer, useSelector } from '@legendapp/state/react';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Card,
  Chip,
  IconButton,
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
  const openAddStockist = useCallback(() => routerInstance.push({ pathname: '/(app)/add-farmer', params: { asStockist: '1' } }), [routerInstance]);
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
        <Surface style={styles.welcomeCard} elevation={0}>
          <View style={styles.welcomeRow}>
            <Pressable
              style={styles.notificationTouch}
              onPress={() => routerInstance.push('/(app)/notifications' as never)}
              android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: true }}
            >
              <IconButton
                icon="bell-outline"
                size={24}
                iconColor={colors.gray700}
                style={styles.notificationIcon}
              />
            </Pressable>
            <View style={styles.welcomeTextBlock}>
              <Text variant="bodyLarge" style={styles.welcomeGreeting}>{greeting}</Text>
              <Text variant="bodyLarge" style={styles.welcomeName}>
                {displayName ?? email ?? (isSupervisor ? 'Supervisor' : 'Field officer')}
              </Text>
              <View style={styles.welcomeMeta}>
                {department ? (
                  <Chip style={styles.tag} textStyle={styles.tagText} compact>
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
                      Synced {label}
                    </Text>
                  );
                })()}
              </View>
            </View>
          </View>
        </Surface>

        <View style={styles.contentContainer}>
          <View style={styles.actionRow}>
            {isOfficer && (
              <ActionCard
                icon="camera"
                label="Record Visit"
                variant="primary"
                onPress={() => openRecordVisit()}
              />
            )}
            <ActionCard
              icon="account-plus"
              label="Add farmer"
              onPress={openAddFarmer}
            />
            <ActionCard
              icon="store-outline"
              label="Add stockist"
              onPress={openAddStockist}
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
            <StatCard icon={STAT_ICONS.farmers} label={`${labels.partner}s`} value={farmers.length} hint="in your list" />
          </View>

          <SectionHeader title="Today's Schedule" />
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
  contentContainer: { flex: 1, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.accentLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', minHeight: 0 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 16 },
  welcomeCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationTouch: {
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  notificationIcon: { margin: 0 },
  welcomeTextBlock: { flex: 1, justifyContent: 'center', minWidth: 0 },
  welcomeGreeting: {
    color: colors.gray500,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  welcomeName: {
    color: colors.gray900,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    marginTop: 2,
  },
  welcomeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  lastSync: { color: colors.gray500, fontSize: 12 },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    height: 28,
  },
  tagText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
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
