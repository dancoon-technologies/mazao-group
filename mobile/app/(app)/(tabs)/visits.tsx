import { ListItemRow } from '@/components/ListItemRow';
import { colors, cardShadow, cardStyle, radius, spacing } from '@/constants/theme';
import { formatDateHeader, isScheduleEditableByDate, scheduleStatusColor, scheduleStatusLabel } from '@/lib/format';
import { syncWithServer } from '@/lib/syncWithServer';
import { farmerRowToFarmer, scheduleRowToSchedule, visitRowToVisit } from '@/lib/offline-helpers';
import { useAppRefresh } from '@/contexts/AppRefreshContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, getLabels, type Schedule, type Visit } from '@/lib/api';
import { appMeta$, farmers$, schedules$, visits$ } from '@/store/observable';
import { useSelector } from '@legendapp/state/react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
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
  Button,
  Card,
  Chip,
  FAB,
  IconButton,
  Searchbar,
  Text,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 56;

type TabKey = 'upcoming' | 'history';

function groupSchedulesByDate(schedules: Schedule[]): { date: string; items: Schedule[] }[] {
  const sorted = [...schedules].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const byDate = new Map<string, Schedule[]>();
  for (const s of sorted) {
    const list = byDate.get(s.scheduled_date) ?? [];
    list.push(s);
    byDate.set(s.scheduled_date, list);
  }
  return Array.from(byDate.entries()).map(([date, items]) => ({ date, items }));
}

function groupPastSchedulesByDate(schedules: Schedule[]): { date: string; items: Schedule[] }[] {
  const sorted = [...schedules].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  const byDate = new Map<string, Schedule[]>();
  for (const s of sorted) {
    const list = byDate.get(s.scheduled_date) ?? [];
    list.push(s);
    byDate.set(s.scheduled_date, list);
  }
  return Array.from(byDate.entries()).map(([date, items]) => ({ date, items }));
}

function groupVisitsByDate(visits: Visit[]): { date: string; items: Visit[] }[] {
  const sorted = [...visits].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const byDate = new Map<string, Visit[]>();
  for (const v of sorted) {
    const date = (v.created_at || '').slice(0, 10);
    if (!date) continue;
    const list = byDate.get(date) ?? [];
    list.push(v);
    byDate.set(date, list);
  }
  return Array.from(byDate.entries()).map(([date, items]) => ({ date, items }));
}

export default function VisitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, role } = useAuth();
  const isSupervisor = role === 'supervisor';
  const isOfficer = role === 'officer';
  const { refreshTrigger } = useAppRefresh();
  const prevRefreshTrigger = useRef(0);
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  /** Reactive read from store — updates when rehydration or sync populates visits$/schedules$. Supervisor sees department data. */
  const visits = useSelector<Visit[]>(() => {
    if (!userId) return [];
    const list = visits$.get() ?? [];
    return list
      .filter((v) => v.is_deleted === 0 && (isSupervisor || v.officer === userId))
      .sort((a, b) => b.created_at - a.created_at)
      .map(visitRowToVisit);
  });
  const schedules = useSelector<Schedule[]>(() => {
    if (!userId) return [];
    const list = schedules$.get() ?? [];
    return list
      .filter((s) => s.is_deleted === 0 && (isSupervisor || s.officer === userId))
      .sort((a, b) => b.scheduled_date - a.scheduled_date)
      .map(scheduleRowToSchedule);
  });
  /** Farmers for fallback when schedule has no farmer_display_name (e.g. old cache). */
  const farmers = useSelector(() => {
    const list = farmers$.get() ?? [];
    return list.map(farmerRowToFarmer);
  });
  const labels = useSelector(() => getLabels(appMeta$.cachedOptions.get()));
  const farmerDisplayName = useCallback(
    (s: Schedule) =>
      s.farmer_display_name ?? farmers.find((f) => f.id === s.farmer)?.display_name ?? `No ${labels.partner.toLowerCase()} assigned`,
    [farmers, labels.partner]
  );

  const load = useCallback(async () => {
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected && userId) {
      try {
        await syncWithServer();
        setError('');
      } catch {
        setError('');
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? false));
    return () => sub();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

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

  const scheduleIdToVisit = useMemo(() => {
    const map: Record<string, Visit> = {};
    for (const v of visits) {
      if (v.schedule) map[v.schedule] = v;
    }
    return map;
  }, [visits]);

  const upcomingSchedules = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return schedules.filter(
      (s) =>
        (s.status === 'accepted' || s.status === 'proposed') &&
        s.scheduled_date >= today &&
        !scheduleIdToVisit[s.id]
    );
  }, [schedules, scheduleIdToVisit]);

  const schedulesByDate = useMemo(
    () => groupSchedulesByDate(upcomingSchedules),
    [upcomingSchedules]
  );

  const pastSchedules = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return schedules.filter(
      (s) =>
        (s.status === 'accepted' || s.status === 'proposed') &&
        (s.scheduled_date < today || !!scheduleIdToVisit[s.id])
    );
  }, [schedules, scheduleIdToVisit]);

  const filteredPastSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pastSchedules;
    return pastSchedules.filter(
      (s) =>
        farmerDisplayName(s).toLowerCase().includes(q) ||
        (s.notes ?? '').toLowerCase().includes(q)
    );
  }, [pastSchedules, search, farmerDisplayName]);

  const pastSchedulesByDate = useMemo(
    () => groupPastSchedulesByDate(filteredPastSchedules),
    [filteredPastSchedules]
  );

  const filteredVisits = useMemo(() => {
    let list = visits;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.farmer_display_name?.toLowerCase().includes(q) ||
          v.farmer?.toLowerCase().includes(q) ||
          v.notes?.toLowerCase().includes(q) ||
          v.activity_type?.toLowerCase().includes(q) ||
          v.farm_display_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [visits, search]);

  const visitsByDate = useMemo(() => groupVisitsByDate(filteredVisits), [filteredVisits]);

  const openProposeSchedule = useCallback(() => router.push('/(app)/propose-schedule'), [router]);

  const openRecordVisit = useCallback(
    (s: Schedule) => {
      router.push({
        pathname: '/(app)/record-visit',
        params: { scheduleId: s.id, ...(s.farmer ? { farmerId: s.farmer } : {}) },
      });
    },
    [router]
  );

  const openEditSchedule = useCallback(
    (s: Schedule) => {
      // Route exists at (app)/edit-schedule/[id].tsx; typed routes may not include it until regenerated
      router.push({ pathname: '/(app)/edit-schedule/[id]', params: { id: s.id } } as never);
    },
    [router]
  );

  const openVisit = useCallback((id: string) => router.push({ pathname: '/(app)/visits/[id]', params: { id } }), [router]);

  return (
    <View style={styles.pageWrap}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Text variant="bodyLarge" style={styles.title}>Visits</Text>
        {/* Tabs */}
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text
              variant="titleMedium"
              style={[styles.tabLabel, activeTab === 'upcoming' && styles.tabLabelActive]}
            >
              Upcoming Visits
            </Text>
            {activeTab === 'upcoming' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text
              variant="titleMedium"
              style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}
            >
              Visit History
            </Text>
            {activeTab === 'history' && <View style={styles.tabIndicator} />}
          </Pressable>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {isOnline === false && (
            <Chip icon="cloud-off-outline" style={styles.offlineChip} compact>
              Offline — showing cached data
            </Chip>
          )}
          {activeTab === 'upcoming' && (
            <>
              {loading ? (
                <ActivityIndicator size="large" style={styles.loader} />
              ) : error ? (
                <Card style={styles.card} elevation={0}>
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.error}>{error}</Text>
                    <Button mode="outlined" onPress={load} style={styles.retryBtn}>Retry</Button>
                  </Card.Content>
                </Card>
              ) : schedulesByDate.length === 0 ? (
                <Card style={styles.card} elevation={0}>
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.emptyText}>No upcoming visits</Text>
                    <Text variant="bodySmall" style={styles.emptySubtext}>
                      Tap + to propose a schedule
                    </Text>
                  </Card.Content>
                </Card>
              ) : (
                schedulesByDate.map(({ date, items }) => (
                  <View key={date} style={styles.dateSection}>
                    <Text variant="labelLarge" style={styles.dateHeader}>
                      {formatDateHeader(date)}
                    </Text>
                    {items.map((s) => {
                      const proposedEditable = s.status === 'proposed' && isScheduleEditableByDate(s.scheduled_date);
                      const rowPress =
                        s.status === 'accepted'
                          ? isOfficer
                            ? () => openRecordVisit(s)
                            : () => openEditSchedule(s)
                          : () => openEditSchedule(s);
                      return (
                        <ListItemRow
                          key={s.id}
                          avatarLetter={(farmerDisplayName(s) || '?').charAt(0)}
                          title={farmerDisplayName(s)}
                          subtitle={`${s.notes || 'Scheduled visit'} · Farm: ${s.farm_display_name ?? 'None'}`}
                          onPress={rowPress}
                          right={
                            <View style={styles.upcomingRight}>
                              <View style={[styles.badge, { backgroundColor: scheduleStatusColor(s.status) + '20' }]}>
                                <Text variant="labelSmall" style={[styles.badgeText, { color: scheduleStatusColor(s.status) }]}>
                                  {scheduleStatusLabel(s.status)}
                                </Text>
                              </View>
                              {s.status === 'proposed' && (
                                <IconButton
                                  icon="pencil"
                                  size={22}
                                  iconColor={colors.primary}
                                  onPress={() => openEditSchedule(s)}
                                  accessibilityLabel={proposedEditable ? 'Edit schedule' : 'View schedule'}
                                />
                              )}
                              {s.status === 'accepted' && isOfficer && (
                                <IconButton
                                  icon="pencil"
                                  size={22}
                                  iconColor={colors.primary}
                                  onPress={() => openRecordVisit(s)}
                                  accessibilityLabel="Record visit"
                                />
                              )}
                            </View>
                          }
                        />
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === 'history' && (
            <>
              <Searchbar
                placeholder="Search visits..."
                value={search}
                onChangeText={setSearch}
                style={styles.searchbar}
              />
              {loading ? (
                <ActivityIndicator size="large" style={styles.loader} />
              ) : error ? (
                <Card style={styles.card} elevation={0}>
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.error}>{error}</Text>
                    <Button mode="outlined" onPress={load} style={styles.retryBtn}>Retry</Button>
                  </Card.Content>
                </Card>
              ) : pastSchedulesByDate.length === 0 ? (
                <Card style={styles.card} elevation={0}>
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.emptyText}>No past scheduled visits</Text>
                    <Text variant="bodySmall" style={styles.emptySubtext}>
                      Accepted visits with past dates appear here
                    </Text>
                  </Card.Content>
                </Card>
              ) : (
                pastSchedulesByDate.map(({ date, items }) => (
                  <View key={date} style={styles.dateSection}>
                    <Text variant="labelLarge" style={styles.dateHeader}>
                      {formatDateHeader(date)}
                    </Text>
                    {items.map((s) => {
                      const recorded = !!scheduleIdToVisit[s.id];
                      const visit = scheduleIdToVisit[s.id];
                      const isProposed = s.status === 'proposed';
                      const rowPress = recorded && visit ? () => openVisit(visit.id) : isProposed ? () => openEditSchedule(s) : undefined;
                      return (
                        <ListItemRow
                          key={s.id}
                          avatarLetter={(farmerDisplayName(s) || '?').charAt(0)}
                          title={farmerDisplayName(s)}
                          subtitle={`${s.notes || 'Scheduled visit'} · Farm: ${s.farm_display_name ?? 'None'}`}
                          right={
                            <View style={styles.pastRight}>
                              {isProposed && (
                                <View style={[styles.badge, { backgroundColor: scheduleStatusColor(s.status) + '20' }]}>
                                  <Text variant="labelSmall" style={[styles.badgeText, { color: scheduleStatusColor(s.status) }]}>
                                    {scheduleStatusLabel(s.status)}
                                  </Text>
                                </View>
                              )}
                              <View style={[styles.badge, { backgroundColor: (recorded ? colors.primary : colors.gray500) + '20' }]}>
                                <Text variant="labelSmall" style={[styles.badgeText, { color: recorded ? colors.primary : colors.gray700 }]}>
                                  {recorded ? 'Recorded' : 'Not recorded'}
                                </Text>
                                <MaterialCommunityIcons name={recorded ? 'check-circle' : 'circle-outline'} size={14} color={recorded ? colors.primary : colors.gray700} />
                              </View>
                            </View>
                          }
                          onPress={rowPress}
                        />
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* FAB - Propose schedule */}
      <View
        style={[styles.fabWrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 4 }]}
        pointerEvents="box-none"
      >
        <FAB
          icon="calendar-plus"
          onPress={openProposeSchedule}
          style={styles.fab}
          color="#fff"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: { flex: 1 },
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: 0 },
  title: { fontWeight: '700', fontSize: 20, paddingHorizontal: spacing.lg, paddingTop: 0 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  tabActive: {},
  tabLabel: {
    color: colors.gray500,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    right: '10%',
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  searchbar: { marginBottom: spacing.md, marginTop: spacing.sm },
  dateSection: { marginBottom: spacing.xl },
  dateHeader: {
    color: colors.gray700,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  upcomingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pastRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 2,
  },
  badgeText: { fontWeight: '600', fontSize: 12 },
  loader: { marginVertical: spacing.xl },
  card: { ...cardStyle, ...cardShadow, marginBottom: spacing.md },
  error: { marginBottom: 8 },
  retryBtn: { marginTop: 8 },
  emptyText: { color: colors.gray700 },
  emptySubtext: { color: colors.gray500, marginTop: 4 },
  offlineChip: { marginBottom: spacing.md },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  fab: {
    backgroundColor: colors.primary,
  },
});
