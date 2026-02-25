import { colors, radius, spacing } from '@/constants/theme';
import { api, type Visit } from '@/lib/api';
import { ACTIVITY_TYPES } from '@/lib/constants/activityTypes';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  Menu,
  Searchbar,
  Text,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 56;

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

type FilterStatus = 'all' | 'verified' | 'rejected' | 'pending' | 'today';

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'pending', label: 'Pending' },
];

export default function VisitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [todayOnly, setTodayOnly] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.getVisits();
      setVisits(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visits');
      setVisits([]);
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

  const filtered = useMemo(() => {
    let list = visits;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.farmer_display_name?.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q) ||
          v.farmer?.toLowerCase().includes(q) ||
          v.notes?.toLowerCase().includes(q) ||
          v.activity_type?.toLowerCase().includes(q) ||
          v.farm_display_name?.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'verified') {
      list = list.filter((v) => (v.verification_status || '').toLowerCase() === 'verified');
    } else if (statusFilter === 'rejected') {
      list = list.filter((v) => (v.verification_status || '').toLowerCase() === 'rejected');
    } else if (statusFilter === 'pending') {
      list = list.filter(
        (v) =>
          (v.verification_status || '').toLowerCase() !== 'verified' &&
          (v.verification_status || '').toLowerCase() !== 'rejected'
      );
    }
    if (todayOnly) {
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter((v) => (v.created_at || '').slice(0, 10) === today);
    }
    return list;
  }, [visits, search, statusFilter, todayOnly]);

  const statusLabel = (v: Visit) => {
    const s = (v.verification_status || '').toLowerCase();
    if (s === 'verified') return 'verified';
    if (s === 'rejected') return 'rejected';
    return 'pending';
  };

  const statusDisplayLabel = (v: Visit) => {
    const s = (v.verification_status || '').toLowerCase();
    if (s === 'verified') return 'Verified';
    if (s === 'rejected') return 'Rejected';
    return 'Pending';
  };

  const currentStatusLabel =
    statusFilter === 'all'
      ? 'All Status'
      : STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'All Status';

  const openProposeSchedule = () => router.push('/(app)/propose-schedule');

  return (
    <View style={styles.pageWrap}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="bodyMedium" style={styles.subtitle}>
            View and manage visit records
          </Text>
        </View>

        <Searchbar
          placeholder="Search visits..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
        />

        <View style={styles.filterRow}>
          <Menu
            visible={statusMenuOpen}
            onDismiss={() => setStatusMenuOpen(false)}
            anchor={
              <Pressable
                style={styles.filterButton}
                onPress={() => setStatusMenuOpen(true)}
              >
                <Text variant="bodyMedium" style={styles.filterButtonText}>
                  {currentStatusLabel}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.gray700} />
              </Pressable>
            }
          >
            {STATUS_OPTIONS.map((opt) => (
              <Menu.Item
                key={opt.value}
                onPress={() => {
                  setStatusFilter(opt.value);
                  setStatusMenuOpen(false);
                }}
                title={opt.label}
              />
            ))}
          </Menu>
          <Pressable
            style={[styles.filterButton, todayOnly && styles.filterButtonActive]}
            onPress={() => setTodayOnly(!todayOnly)}
          >
            <MaterialCommunityIcons
              name="calendar"
              size={20}
              color={todayOnly ? colors.primary : colors.gray700}
            />
            <Text
              variant="bodyMedium"
              style={[styles.filterButtonText, todayOnly && styles.filterButtonTextActive]}
            >
              Today
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : error ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.error}>{error}</Text>
              <Button mode="outlined" onPress={load} style={styles.retryBtn}>
                Retry
              </Button>
            </Card.Content>
          </Card>
        ) : filtered.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium">No visits found</Text>
            </Card.Content>
          </Card>
        ) : (
          filtered.map((v) => (
            <Pressable
              key={v.id}
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/(app)/visits/[id]', params: { id: v.id } })}
            >
              <Card style={styles.visitCard} elevation={1}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Text variant="titleMedium" style={styles.cardName}>
                      {v.farmer_display_name ?? v.farmer ?? 'Unknown'}
                    </Text>
                    <View
                      style={[
                        styles.statusChip,
                        statusLabel(v) === 'verified' && styles.status_verified,
                        statusLabel(v) === 'rejected' && styles.status_rejected,
                        statusLabel(v) === 'pending' && styles.status_pending,
                      ]}
                    >
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.statusChipText,
                          statusLabel(v) === 'rejected' && styles.statusChipTextRejected,
                          statusLabel(v) === 'pending' && styles.statusChipTextPending,
                        ]}
                      >
                        {statusDisplayLabel(v)}
                      </Text>
                    </View>
                  </View>
                  <Text variant="bodyMedium" style={styles.visitType}>
                    {getActivityLabel(v.activity_type || '')}
                  </Text>
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.gray700} />
                      <Text variant="bodySmall" style={styles.detailText}>
                        {v.farm_display_name || '—'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="calendar-outline" size={16} color={colors.gray700} />
                      <Text variant="bodySmall" style={styles.detailText}>
                        {formatDateShort(v.created_at)}
                      </Text>
                    </View>
                  </View>
                  {(v.notes || v.farmers_feedback) ? (
                    <Text variant="bodySmall" style={styles.notes} numberOfLines={2}>
                      {v.notes || v.farmers_feedback}
                    </Text>
                  ) : null}
                </Card.Content>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
      </SafeAreaView>
      <View
        style={[styles.fabWrap, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 8 }]}
        pointerEvents="box-none"
      >
        <FAB
          icon="calendar-plus"
          onPress={openProposeSchedule}
          mode="elevated"
          label="Propose schedule"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: { flex: 1 },
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 100 },
  header: { marginBottom: spacing.lg },
  subtitle: { color: colors.gray700 },
  searchbar: { marginBottom: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
  },
  filterButtonActive: { backgroundColor: colors.primaryLight },
  filterButtonText: { color: colors.gray900 },
  filterButtonTextActive: { color: colors.primary, fontWeight: '600' },
  loader: { marginVertical: spacing.xl },
  card: { marginBottom: spacing.md },
  visitCard: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  pressed: { opacity: 0.9 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardName: { fontWeight: '700', color: colors.gray900, flex: 1 },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  status_verified: { backgroundColor: colors.primaryLight },
  status_rejected: { backgroundColor: colors.errorLight },
  status_pending: { backgroundColor: colors.gray200 },
  statusChipText: { color: colors.primary, fontWeight: '600', fontSize: 11 },
  statusChipTextRejected: { color: colors.error },
  statusChipTextPending: { color: colors.gray700 },
  visitType: { color: colors.gray700, marginBottom: spacing.sm },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: 4 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { color: colors.gray700 },
  notes: { color: colors.gray700, marginTop: 4, fontStyle: 'italic' },
  error: { marginBottom: 8 },
  retryBtn: { marginTop: 8 },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
});
