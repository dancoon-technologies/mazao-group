import { ListItemRow } from '@/components/ListItemRow';
import { colors, cardShadow, cardStyle, radius, spacing } from '@/constants/theme';
import { toLocalYmd } from '@/lib/dateLocal';
import { formatDateHeader, isScheduleEditableByDate, scheduleStatusColor, scheduleStatusLabel } from '@/lib/format';
import { syncWithServer } from '@/lib/syncWithServer';
import { farmerRowToFarmer, scheduleRowToSchedule, visitRowToVisit } from '@/lib/offline-helpers';
import { useAppRefresh } from '@/contexts/AppRefreshContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, getLabels, type Route, type Schedule, type Visit } from '@/lib/api';
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
  Menu,
  Searchbar,
  Text,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 56;

type TabKey = 'upcoming' | 'past';

/** Single visit schedule or one day route plan (many visits can share the same route). */
type PlanRow =
  | { kind: 'schedule'; date: string; schedule: Schedule }
  | { kind: 'route'; date: string; route: Route };

function sortPlanRows(rows: PlanRow[]): PlanRow[] {
  return [...rows].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    if (a.kind !== b.kind) return a.kind === 'schedule' ? -1 : 1;
    if (a.kind === 'schedule' && b.kind === 'schedule') {
      return a.schedule.id.localeCompare(b.schedule.id);
    }
    if (a.kind === 'route' && b.kind === 'route') {
      return a.route.id.localeCompare(b.route.id);
    }
    return 0;
  });
}

function groupPlanRowsByDateAsc(rows: PlanRow[]): { date: string; items: PlanRow[] }[] {
  const sorted = sortPlanRows(rows);
  const byDate = new Map<string, PlanRow[]>();
  for (const r of sorted) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }
  return Array.from(byDate.entries()).map(([date, items]) => ({ date, items }));
}

function groupPlanRowsByDateDesc(rows: PlanRow[]): { date: string; items: PlanRow[] }[] {
  const grouped = groupPlanRowsByDateAsc(rows);
  return [...grouped].sort((a, b) => b.date.localeCompare(a.date));
}

export default function SchedulesScreen() {
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
  const [routesMenuOpen, setRoutesMenuOpen] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);

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
  const farmers = useSelector(() => {
    const list = farmers$.get() ?? [];
    return list.map(farmerRowToFarmer);
  });
  const labels = useSelector(() => getLabels(appMeta$.cachedOptions.get()));
  const farmerDisplayName = useCallback(
    (s: Schedule) => {
      const farmer = farmers.find((f) => f.id === s.farmer);
      const name = s.farmer_display_name ?? farmer?.display_name ?? `No ${labels.partner.toLowerCase()} assigned`;
      return farmer?.is_stockist ? `${name} · Stockist` : name;
    },
    [farmers, labels.partner]
  );
  const load = useCallback(async () => {
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected && userId) {
      try {
        await syncWithServer();
        try {
          const list = await api.getAllRoutes();
          setRoutes(Array.isArray(list) ? list : []);
        } catch {
          setRoutes([]);
        }
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

  const today = toLocalYmd(new Date());
  const routesVisible = useMemo(() => {
    if (!userId) return [];
    if (role === 'admin' || isSupervisor) return routes;
    return routes.filter((r) => r.officer === userId);
  }, [routes, userId, role, isSupervisor]);

  const upcomingSchedules = useMemo(() => {
    return schedules.filter(
      (s) =>
        (s.status === 'accepted' || s.status === 'proposed') &&
        s.scheduled_date >= today &&
        !scheduleIdToVisit[s.id]
    );
  }, [schedules, scheduleIdToVisit, today]);

  const upcomingPlanRows = useMemo((): PlanRow[] => {
    const schedulePart: PlanRow[] = upcomingSchedules.map((s) => ({
      kind: 'schedule',
      date: s.scheduled_date,
      schedule: s,
    }));
    const routePart: PlanRow[] = [];
    for (const route of routesVisible) {
      if (route.scheduled_date < today) continue;
      routePart.push({ kind: 'route', date: route.scheduled_date, route });
    }
    return [...schedulePart, ...routePart];
  }, [upcomingSchedules, routesVisible, today]);

  const upcomingByDate = useMemo(() => groupPlanRowsByDateAsc(upcomingPlanRows), [upcomingPlanRows]);

  const pastSchedules = useMemo(() => {
    return schedules.filter(
      (s) =>
        (s.status === 'accepted' || s.status === 'proposed') &&
        (s.scheduled_date < today || !!scheduleIdToVisit[s.id])
    );
  }, [schedules, scheduleIdToVisit, today]);

  const pastPlanRows = useMemo((): PlanRow[] => {
    const schedulePart: PlanRow[] = pastSchedules.map((s) => ({
      kind: 'schedule',
      date: s.scheduled_date,
      schedule: s,
    }));
    const routePart: PlanRow[] = [];
    for (const route of routesVisible) {
      const visitCount = visits.filter((v) => v.route === route.id).length;
      if (route.scheduled_date < today || visitCount > 0) {
        routePart.push({ kind: 'route', date: route.scheduled_date, route });
      }
    }
    return [...schedulePart, ...routePart];
  }, [pastSchedules, routesVisible, visits, today]);

  const filteredPastPlanRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pastPlanRows;
    return pastPlanRows.filter((row) => {
      if (row.kind === 'schedule') {
        const s = row.schedule;
        return (
          farmerDisplayName(s).toLowerCase().includes(q) ||
          (s.notes ?? '').toLowerCase().includes(q)
        );
      }
      const r = row.route;
      return (
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [pastPlanRows, search, farmerDisplayName]);

  const pastByDate = useMemo(() => groupPlanRowsByDateDesc(filteredPastPlanRows), [filteredPastPlanRows]);

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
      router.push({ pathname: '/(app)/edit-schedule/[id]', params: { id: s.id } } as never);
    },
    [router]
  );
  const openVisit = useCallback((id: string) => router.push({ pathname: '/(app)/visits/[id]', params: { id } }), [router]);

  const openRouteFormForRoute = useCallback(
    (r: Route) => {
      router.push({
        pathname: '/(app)/route-form',
        params: { date: r.scheduled_date, routeId: r.id },
      } as never);
    },
    [router]
  );

  const openRecordWithRoute = useCallback(
    (route: Route) => {
      router.push({
        pathname: '/(app)/record-visit',
        params: { routeId: route.id },
      } as never);
    },
    [router]
  );

  const openWeeklyPlan = useCallback(
    () =>
      router.push({
        pathname: '/(app)/propose-schedule',
        params: { planMode: 'weekly' },
      } as never),
    [router]
  );
  const openRouteReport = useCallback(() => router.push('/(app)/route-report' as never), [router]);

  return (
    <View style={styles.pageWrap}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.titleRow}>
          <Text variant="bodyLarge" style={styles.title}>Schedules</Text>
          {isOfficer && (
            <Menu
              visible={routesMenuOpen}
              onDismiss={() => setRoutesMenuOpen(false)}
              anchor={
                <Button
                  mode="outlined"
                  compact
                  onPress={() => setRoutesMenuOpen(true)}
                  style={styles.routesMenuAnchor}
                  icon="map-marker-path"
                >
                  Routes
                </Button>
              }
            >
              <Menu.Item
                onPress={() => {
                  setRoutesMenuOpen(false);
                  openWeeklyPlan();
                }}
                title="Weekly plan"
                leadingIcon="calendar-week"
              />
              <Menu.Item
                onPress={() => {
                  setRoutesMenuOpen(false);
                  openRouteReport();
                }}
                title="Route report"
                leadingIcon="clipboard-text-outline"
              />
            </Menu>
          )}
        </View>
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text
              variant="titleMedium"
              style={[styles.tabLabel, activeTab === 'upcoming' && styles.tabLabelActive]}
            >
              Upcoming
            </Text>
            {activeTab === 'upcoming' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'past' && styles.tabActive]}
            onPress={() => setActiveTab('past')}
          >
            <Text
              variant="titleMedium"
              style={[styles.tabLabel, activeTab === 'past' && styles.tabLabelActive]}
            >
              Past
            </Text>
            {activeTab === 'past' && <View style={styles.tabIndicator} />}
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
              ) : upcomingByDate.length === 0 ? (
                <Card style={styles.card} elevation={0}>
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.emptyText}>No upcoming visits</Text>
                    <Text variant="bodySmall" style={styles.emptySubtext}>
                      Single schedules and day routes for today or later appear here. Tap + to add a schedule.
                    </Text>
                  </Card.Content>
                </Card>
              ) : (
                upcomingByDate.map(({ date, items }) => (
                  <View key={date} style={styles.dateSection}>
                    <Text variant="labelLarge" style={styles.dateHeader}>
                      {formatDateHeader(date)}
                    </Text>
                    {items.map((row) => {
                      if (row.kind === 'schedule') {
                        const s = row.schedule;
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
                            subtitle={`${s.notes || 'Scheduled visit'} · ${labels.location}: ${s.farm_display_name ?? 'None'}`}
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
                                  <>
                                    <IconButton
                                      icon="calendar-edit"
                                      size={22}
                                      iconColor={colors.primary}
                                      onPress={() => openEditSchedule(s)}
                                      accessibilityLabel="Request schedule change"
                                    />
                                    <IconButton
                                      icon="camera"
                                      size={22}
                                      iconColor={colors.primary}
                                      onPress={() => openRecordVisit(s)}
                                      accessibilityLabel="Record visit"
                                    />
                                  </>
                                )}
                              </View>
                            }
                          />
                        );
                      }
                      if (row.kind === 'route') {
                        const { route } = row;
                        const title = route.name?.trim() ? route.name : 'Day route';
                        const visitCount = visits.filter((v) => v.route === route.id).length;
                        const rowPress = isOfficer
                          ? () => openRecordWithRoute(route)
                          : () => openRouteFormForRoute(route);
                        return (
                          <ListItemRow
                            key={`rt-up-${route.id}`}
                            avatarLetter="R"
                            title={title}
                            subtitle={
                              visitCount > 0
                                ? `${visitCount} visit(s) logged · tap to add another`
                                : 'Day plan · record visits against this route'
                            }
                            onPress={rowPress}
                            right={
                              <View style={styles.upcomingRight}>
                                <View style={[styles.badge, { backgroundColor: colors.gray200 }]}>
                                  <Text variant="labelSmall" style={[styles.badgeText, { color: colors.gray700 }]}>
                                    Route
                                  </Text>
                                </View>
                                {isOfficer && (
                                  <>
                                    <IconButton
                                      icon="pencil"
                                      size={22}
                                      iconColor={colors.primary}
                                      onPress={() => openRouteFormForRoute(route)}
                                      accessibilityLabel="Edit route"
                                    />
                                    <IconButton
                                      icon="camera"
                                      size={22}
                                      iconColor={colors.primary}
                                      onPress={() => openRecordWithRoute(route)}
                                      accessibilityLabel="Record visit"
                                    />
                                  </>
                                )}
                              </View>
                            }
                          />
                        );
                      }
                      return null;
                    })}
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === 'past' && (
            <>
              <Searchbar
                placeholder="Search schedules and routes..."
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
              ) : pastByDate.length === 0 ? (
                <Card style={styles.card} elevation={0}>
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.emptyText}>No past visits</Text>
                    <Text variant="bodySmall" style={styles.emptySubtext}>
                      Older schedules and routes with visit history appear here
                    </Text>
                  </Card.Content>
                </Card>
              ) : (
                pastByDate.map(({ date, items }) => (
                  <View key={date} style={styles.dateSection}>
                    <Text variant="labelLarge" style={styles.dateHeader}>
                      {formatDateHeader(date)}
                    </Text>
                    {items.map((row) => {
                      if (row.kind === 'schedule') {
                        const s = row.schedule;
                        const recorded = !!scheduleIdToVisit[s.id];
                        const visit = scheduleIdToVisit[s.id];
                        const isProposed = s.status === 'proposed';
                        const rowPress =
                          recorded && visit
                            ? () => openVisit(visit.id)
                            : isProposed
                              ? () => openEditSchedule(s)
                              : undefined;
                        return (
                          <ListItemRow
                            key={s.id}
                            avatarLetter={(farmerDisplayName(s) || '?').charAt(0)}
                            title={farmerDisplayName(s)}
                            subtitle={`${s.notes || 'Scheduled visit'} · ${labels.location}: ${s.farm_display_name ?? 'None'}`}
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
                      }
                      if (row.kind === 'route') {
                        const { route } = row;
                        const routeVisits = visits.filter((v) => v.route === route.id);
                        const visitCount = routeVisits.length;
                        const title = route.name?.trim() ? route.name : 'Day route';
                        const rowPress =
                          visitCount > 0 && routeVisits[0]
                            ? () => openVisit(routeVisits[0].id)
                            : isOfficer
                              ? () => openRecordWithRoute(route)
                              : () => openRouteFormForRoute(route);
                        return (
                          <ListItemRow
                            key={`rt-past-${route.id}`}
                            avatarLetter="R"
                            title={title}
                            subtitle={
                              visitCount > 0
                                ? `${visitCount} visit(s) on this route`
                                : 'No visits logged yet'
                            }
                            right={
                              <View style={styles.pastRight}>
                                <View style={[styles.badge, { backgroundColor: colors.gray200 }]}>
                                  <Text variant="labelSmall" style={[styles.badgeText, { color: colors.gray700 }]}>
                                    Route
                                  </Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: (visitCount > 0 ? colors.primary : colors.gray500) + '20' }]}>
                                  <Text variant="labelSmall" style={[styles.badgeText, { color: visitCount > 0 ? colors.primary : colors.gray700 }]}>
                                    {visitCount > 0 ? `${visitCount} visit(s)` : 'None'}
                                  </Text>
                                  <MaterialCommunityIcons name={visitCount > 0 ? 'check-circle' : 'circle-outline'} size={14} color={visitCount > 0 ? colors.primary : colors.gray700} />
                                </View>
                              </View>
                            }
                            onPress={rowPress}
                          />
                        );
                      }
                      return null;
                    })}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 0, paddingBottom: spacing.sm },
  title: { fontWeight: '700', fontSize: 20 },
  titleActions: { flexDirection: 'row', gap: spacing.sm },
  routesMenuAnchor: { minWidth: 0 },
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
