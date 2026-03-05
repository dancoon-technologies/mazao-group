import { colors, radius, spacing } from '@/constants/theme';
import { api, type Schedule, type Visit } from '@/lib/api';
import { ACTIVITY_TYPES } from '@/lib/constants/activityTypes';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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
  FAB,
  Searchbar,
  Text,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 56;

function formatDateHeader(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getActivityLabel(value: string): string {
  const found = ACTIVITY_TYPES.find((a) => a.value === value);
  return found?.label ?? value.replace(/_/g, ' ');
}

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

function scheduleStatusColor(status: Schedule['status']): string {
  if (status === 'accepted') return colors.primary;
  if (status === 'rejected') return colors.error;
  return colors.primary; // green for proposed
}

function visitStatusColor(verification_status: string): string {
  const s = (verification_status || '').toLowerCase();
  if (s === 'verified') return colors.primary;
  if (s === 'rejected') return colors.error;
  return colors.accent; // orange for pending
}

export default function VisitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [visitsData, schedulesData] = await Promise.all([
        api.getVisits(),
        api.getSchedules(),
      ]);
      setVisits(Array.isArray(visitsData) ? visitsData : []);
      setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setVisits([]);
      setSchedules([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  const schedulesByDate = useMemo(() => groupSchedulesByDate(schedules), [schedules]);

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

  const openProposeSchedule = () => router.push('/(app)/propose-schedule');

  const scheduleStatusLabel = (s: Schedule) =>
    s.status.charAt(0).toUpperCase() + s.status.slice(1);

  const visitStatusLabel = (v: Visit) => {
    const s = (v.verification_status || '').toLowerCase();
    if (s === 'verified') return 'Verified';
    if (s === 'rejected') return 'Rejected';
    return 'Pending';
  };

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
                      <Pressable
                        key={s.id}
                        style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
                        onPress={() =>
                          router.push(
                            s.farmer
                              ? { pathname: '/(app)/record-visit', params: { farmerId: s.farmer, scheduleId: s.id } }
                              : { pathname: '/(app)/record-visit', params: { scheduleId: s.id } }
                          )
                        }
                      >
                        <View style={styles.avatarCircle}>
                          <Text variant="titleMedium" style={styles.avatarText}>
                            {(s.farmer_display_name || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.listCardBody}>
                          <Text variant="titleMedium" style={styles.listCardName} numberOfLines={1}>
                            {s.farmer_display_name ?? 'No farmer assigned'}
                          </Text>
                          <Text variant="bodySmall" style={styles.listCardSubtext} numberOfLines={1}>
                            {s.notes || 'Scheduled visit'}
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: scheduleStatusColor(s.status) + '20' }]}>
                          <Text variant="labelSmall" style={[styles.badgeText, { color: scheduleStatusColor(s.status) }]}>
                            {scheduleStatusLabel(s)}
                          </Text>
                          <MaterialCommunityIcons name="chevron-down" size={14} color={scheduleStatusColor(s.status)} />
                        </View>
                      </Pressable>
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
              ) : visitsByDate.length === 0 ? (
                <Card style={styles.card} elevation={0}>
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.emptyText}>No recorded visits</Text>
                    <Text variant="bodySmall" style={styles.emptySubtext}>
                      Record a visit from the Record tab
                    </Text>
                  </Card.Content>
                </Card>
              ) : (
                visitsByDate.map(({ date, items }) => (
                  <View key={date} style={styles.dateSection}>
                    <Text variant="labelLarge" style={styles.dateHeader}>
                      {formatDateHeader(date)}
                    </Text>
                    {items.map((v) => (
                      <Pressable
                        key={v.id}
                        style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
                        onPress={() => router.push({ pathname: '/(app)/visits/[id]', params: { id: v.id } })}
                      >
                        <View style={styles.avatarCircle}>
                          <Text variant="titleMedium" style={styles.avatarText}>
                            {(v.farmer_display_name || v.farmer || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.listCardBody}>
                          <Text variant="titleMedium" style={styles.listCardName} numberOfLines={1}>
                            {v.farmer_display_name ?? v.farmer ?? 'Unknown'}
                          </Text>
                          <Text variant="bodySmall" style={styles.listCardSubtext} numberOfLines={1}>
                            {getActivityLabel(v.activity_type || '')} · {formatDateShort(v.created_at)}
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: visitStatusColor(v.verification_status) + '20' }]}>
                          <Text variant="labelSmall" style={[styles.badgeText, { color: visitStatusColor(v.verification_status) }]}>
                            {visitStatusLabel(v)}
                          </Text>
                          <MaterialCommunityIcons name="chevron-down" size={14} color={visitStatusColor(v.verification_status)} />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* FAB - Propose schedule */}
      <View
        style={[styles.fabWrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}
        pointerEvents="box-none"
      >
        <FAB
          icon="plus"
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
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  listCardBody: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  listCardName: { fontWeight: '700', color: colors.gray900 },
  listCardSubtext: { color: colors.gray700, marginTop: 2 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontWeight: '700', color: colors.gray700 },
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
  card: { marginBottom: spacing.md },
  error: { marginBottom: 8 },
  retryBtn: { marginTop: 8 },
  emptyText: { color: colors.gray700 },
  emptySubtext: { color: colors.gray500, marginTop: 4 },
  pressed: { opacity: 0.9 },
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
