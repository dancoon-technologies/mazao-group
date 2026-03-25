import { ListItemRow } from '@/components/ListItemRow';
import { useAuth } from '@/contexts/AuthContext';
import { api, type LocationReport } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { colors, spacing } from '@/constants/theme';
import { useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0 || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function reportTime(r: LocationReport): string {
  return r.reported_at_server ?? r.reported_at;
}

function formatLatLng(n: number, decimals = 5): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals);
}

const USER_COLORS = ['#228be6', '#40c057', '#fd7e14', '#be4bdb', '#fa5252', '#15aabf', '#fab005', '#7950f2'];
function hashToIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % mod;
}

export default function TrackingTeamScreen() {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const isSupervisor = role === 'supervisor';

  const [reports, setReports] = useState<LocationReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupervisor) {
        setReports([]);
        setError('Not available.');
        return;
      }
      const net = await NetInfo.fetch();
      const online = net.isConnected ?? false;
      if (!online) {
        setError('Connect to load team updates.');
        setReports([]);
        return;
      }

      const list = await api.getTrackingReports({
        date: new Date().toISOString().slice(0, 10),
        page_size: 200,
      });
      setReports(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team updates.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [isSupervisor]);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const latestByUser = useMemo(() => {
    const map = new Map<string, LocationReport>();
    for (const r of reports) {
      const uid = r.user_id ?? 'unknown';
      const existing = map.get(uid);
      if (!existing || new Date(reportTime(r)).getTime() > new Date(reportTime(existing)).getTime()) {
        map.set(uid, r);
      }
    }
    return Array.from(map.values());
  }, [reports]);

  const listForToday = useMemo(() => {
    return [...latestByUser].sort(
      (a, b) => new Date(reportTime(b)).getTime() - new Date(reportTime(a)).getTime()
    );
  }, [latestByUser]);

  const durationByReportId = useMemo(() => {
    const byUser = new Map<string, LocationReport[]>();
    for (const r of reports) {
      const uid = r.user_id ?? 'unknown';
      const list = byUser.get(uid) ?? [];
      list.push(r);
      byUser.set(uid, list);
    }
    const map = new Map<string, number>();
    byUser.forEach((list) => {
      const sorted = [...list].sort(
        (a, b) => new Date(reportTime(a)).getTime() - new Date(reportTime(b)).getTime()
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        const sec = (new Date(reportTime(b)).getTime() - new Date(reportTime(a)).getTime()) / 1000;
        map.set(a.id, sec);
      }
    });
    return map;
  }, [reports]);

  const bounds = useMemo(() => {
    if (latestByUser.length === 0) return null;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const r of latestByUser) {
      if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue;
      minLat = Math.min(minLat, r.latitude);
      maxLat = Math.max(maxLat, r.latitude);
      minLon = Math.min(minLon, r.longitude);
      maxLon = Math.max(maxLon, r.longitude);
    }
    if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
    return { minLat, maxLat, minLon, maxLon };
  }, [latestByUser]);

  const mapDots = useMemo(() => {
    if (!bounds) return [];
    const lonSpan = bounds.maxLon - bounds.minLon || 1;
    const latSpan = bounds.maxLat - bounds.minLat || 1;
    return latestByUser.map((r) => {
      const uid = r.user_id ?? 'unknown';
      const x = ((r.longitude - bounds.minLon) / lonSpan) * 100;
      const y = ((bounds.maxLat - r.latitude) / latSpan) * 100;
      const color = USER_COLORS[hashToIndex(uid, USER_COLORS.length)] ?? colors.primary;
      return { report: r, x, y, color };
    });
  }, [bounds, latestByUser]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 24 }}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="map-marker-path" size={22} color={colors.primary} />
            <Text variant="titleMedium" style={styles.title}>
              Track team
            </Text>
          </View>
          <IconButton icon="refresh" onPress={loadReports} disabled={loading} />
        </View>

        {error ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.errorText}>
                {error}
              </Text>
            </Card.Content>
          </Card>
        ) : loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" />
          </View>
        ) : listForToday.length === 0 ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.emptyText}>
                No team updates yet.
              </Text>
              <Text variant="bodySmall" style={styles.emptySub}>
                Updates are sent during working hours.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            <Card style={styles.card} elevation={0}>
              <Card.Content>
                <Text variant="labelLarge" style={styles.mapTitle}>
                  Map (today)
                </Text>
                <Text variant="bodySmall" style={styles.mapSub}>
                  Latest point per team member
                </Text>
                <View style={styles.mapArea}>
                  {mapDots.map(({ report: r, x, y, color }) => (
                    <View
                      key={r.id}
                      style={[
                        styles.dot,
                        { backgroundColor: color, left: `${x}%`, top: `${y}%` },
                      ]}
                    />
                  ))}
                </View>
              </Card.Content>
            </Card>

            {listForToday.slice(0, 20).map((r) => {
              const userName = r.user_display_name || r.user_email || 'User';
              const subtitle = `${formatDateTime(reportTime(r))} · ${formatDuration(durationByReportId.get(r.id))} · ${formatLatLng(
                r.latitude
              )}, ${formatLatLng(r.longitude)}`;
              const battery = r.battery_percent != null ? `${Math.round(r.battery_percent)}%` : '—';
              const integrity = r.integrity_warning ? String(r.integrity_warning) : null;
              return (
                <ListItemRow
                  key={r.id}
                  avatarLetter={userName.charAt(0)}
                  title={userName}
                  subtitle={subtitle}
                  subtitleNumberOfLines={2}
                  right={
                    <View style={styles.rightWrap}>
                      <View style={[styles.badge, { backgroundColor: colors.gray200 }]}>
                        <Text variant="labelSmall" style={styles.badgeText}>
                          {battery}
                        </Text>
                      </View>
                      {integrity ? (
                        <View style={[styles.badge, { backgroundColor: colors.error + '20' }]}>
                          <Text variant="labelSmall" style={styles.badgeErrorText}>
                            {integrity}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  }
                />
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '700', marginLeft: 8 },
  card: { marginBottom: spacing.md },
  errorText: { color: colors.error },
  emptyText: { color: colors.gray700, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: colors.gray500 },
  loadingWrap: { paddingVertical: spacing.xl },
  rightWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.gray700 },
  badgeErrorText: { fontSize: 12, fontWeight: '700', color: colors.error },
  mapTitle: { fontWeight: '700', marginBottom: 2 },
  mapSub: { color: colors.gray500, marginBottom: spacing.sm },
  mapArea: {
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    transform: [{ translateX: -5 }, { translateY: -5 }],
    borderWidth: 2,
    borderColor: colors.white,
  },
});

