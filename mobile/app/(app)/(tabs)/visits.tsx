import { ListItemRow } from '@/components/ListItemRow';
import { colors, cardShadow, cardStyle, radius, spacing } from '@/constants/theme';
import { getAllSchedulesForOfficer, getVisitsForOfficer } from '@/database';
import { formatDateHeader, scheduleStatusColor, scheduleStatusLabel, visitStatusColor } from '@/lib/format';
import { scheduleRowToSchedule, visitRowToVisit } from '@/lib/offline-helpers';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Schedule, type Visit } from '@/lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const loadFromDb = useCallback(async () => {
    if (!userId) return;
    try {
      const [visitRows, scheduleRows] = await Promise.all([
        getVisitsForOfficer(userId),
        getAllSchedulesForOfficer(userId),
      ]);
      setVisits(visitRows.map(visitRowToVisit));
      setSchedules(scheduleRows.map(scheduleRowToSchedule));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load offline data');
      setVisits([]);
      setSchedules([]);
    }
  }, [userId]);

  const load = useCallback(async () => {
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected) {
      try {
        const [visitsData, schedulesData] = await Promise.all([
          api.getVisits(),
          api.getSchedules(),
        ]);
        setVisits(Array.isArray(visitsData) ? visitsData : []);
        setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
        setError('');
      } catch (e) {
        if (userId) {
          await loadFromDb();
          setError('');
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load');
          setVisits([]);
          setSchedules([]);
        }
      }
    } else if (userId) {
      await loadFromDb();
    } else {
      setVisits([]);
      setSchedules([]);
      setError('');
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId, loadFromDb]);

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
        s.status === 'accepted' &&
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
        s.status === 'accepted' &&
        (s.scheduled_date < today || !!scheduleIdToVisit[s.id])
    );
  }, [schedules, scheduleIdToVisit]);

  const filteredPastSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pastSchedules;
    return pastSchedules.filter(
      (s) =>
        (s.farmer_display_name ?? '').toLowerCase().includes(q) ||
        (s.notes ?? '').toLowerCase().includes(q)
    );
  }, [pastSchedules, search]);

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

  const openVisit = useCallback((id: string) => router.push({ pathname: '/(app)/visits/[id]', params: { id } }), [router]);

  return (
    <View style={styles.pageWrap}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
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
                    {items.map((s) => (
                      <ListItemRow
                        key={s.id}
                        avatarLetter={s.farmer_display_name ?? '?'}
                        title={s.farmer_display_name ?? 'No farmer assigned'}
                        subtitle={`${s.notes || 'Scheduled visit'} · Farm: ${s.farm_display_name ?? 'None'}`}
                        onPress={() => openRecordVisit(s)}
                        right={
                          <View style={styles.upcomingRight}>
                            <View style={[styles.badge, { backgroundColor: scheduleStatusColor(s.status) + '20' }]}>
                              <Text variant="labelSmall" style={[styles.badgeText, { color: scheduleStatusColor(s.status) }]}>
                                {scheduleStatusLabel(s.status)}
                              </Text>
                            </View>
                            <IconButton
                              icon="pencil"
                              size={22}
                              iconColor={colors.primary}
                              onPress={() => openRecordVisit(s)}
                            />
                          </View>
                        }
                      />
                    ))}
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
                      return (
                        <ListItemRow
                          key={s.id}
                          avatarLetter={s.farmer_display_name ?? '?'}
                          title={s.farmer_display_name ?? 'No farmer assigned'}
                          subtitle={`${s.notes || 'Scheduled visit'} · Farm: ${s.farm_display_name ?? 'None'}`}
                          right={
                            <View style={[styles.badge, { backgroundColor: (recorded ? colors.primary : colors.gray500) + '20' }]}>
                              <Text variant="labelSmall" style={[styles.badgeText, { color: recorded ? colors.primary : colors.gray700 }]}>
                                {recorded ? 'Recorded' : 'Not recorded'}
                              </Text>
                              <MaterialCommunityIcons name={recorded ? 'check-circle' : 'circle-outline'} size={14} color={recorded ? colors.primary : colors.gray700} />
                            </View>
                          }
                          onPress={recorded && visit ? () => openVisit(visit.id) : undefined}
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
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
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
