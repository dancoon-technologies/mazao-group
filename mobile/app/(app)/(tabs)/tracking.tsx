import { ListItemRow } from '@/components/ListItemRow';
import { LocationMiniMap, type LocationMiniMapPoint } from '@/components/LocationMiniMap';
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
import { trackingReports$ } from '@/store/observable';

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
        const cached = trackingReports$.get();
        setReports(cached ?? []);
        setError(cached ? 'Offline — showing saved updates.' : 'Offline — no saved updates yet.');
        return;
      }

      const list = await api.getTrackingReports({
        date: new Date().toISOString().slice(0, 10),
        page_size: 200,
      });
      const safeList = Array.isArray(list) ? list : [];
      setReports(safeList);
      trackingReports$.set(safeList);
    } catch (e) {
      const cached = trackingReports$.get();
      if (cached) {
        setReports(cached);
        setError('Showing saved updates (sync failed).');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load team updates.');
        setReports([]);
      }
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

  const mapPoints = useMemo((): LocationMiniMapPoint[] => {
    return latestByUser
      .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
      .map((r) => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        colorKey: r.user_id ?? 'unknown',
      }));
  }, [latestByUser]);

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
            {mapPoints.length > 0 ? (
              <Card style={styles.card} elevation={0}>
                <Card.Content>
                  <LocationMiniMap
                    points={mapPoints}
                    height={220}
                    title="Map (today)"
                    subtitle="Latest point per team member"
                  />
                </Card.Content>
              </Card>
            ) : null}

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
});

