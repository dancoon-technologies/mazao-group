import { ListItemRow } from '@/components/ListItemRow';
import { useAuth } from '@/contexts/AuthContext';
import { getVisitsForOfficer } from '@/database';
import { visitRowToVisit } from '@/lib/offline-helpers';
import { api, type Visit } from '@/lib/api';
import { useFocusEffect, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Card, Text, Button } from 'react-native-paper';
import { colors, cardShadow, cardStyle, radius, spacing } from '@/constants/theme';

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function visitStatusColor(verification_status: string): string {
  const s = (verification_status || '').toLowerCase();
  if (s === 'verified') return colors.primary;
  if (s === 'rejected') return colors.error;
  return colors.accent;
}

function visitStatusLabel(v: Visit): string {
  const s = (v.verification_status || '').toLowerCase();
  if (s === 'verified') return 'Verified';
  if (s === 'rejected') return 'Rejected';
  return 'Pending';
}

export default function HistoryScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const loadFromDb = useCallback(async () => {
    if (!userId) return;
    const rows = await getVisitsForOfficer(userId);
    setVisits(rows.map(visitRowToVisit));
    setError(null);
    setForbidden(false);
  }, [userId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected) {
      try {
        const data = await api.getVisits();
        setVisits(Array.isArray(data) ? data : []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load';
        const isForbidden =
          msg.includes('403') ||
          msg.toLowerCase().includes('forbidden') ||
          msg.toLowerCase().includes('permission');
        if (isForbidden) {
          setForbidden(true);
          setVisits([]);
        } else if (userId) {
          await loadFromDb();
        } else {
          setError(msg);
        }
      }
    } else if (userId) {
      await loadFromDb();
    }
    setLoading(false);
  }, [userId, loadFromDb]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (forbidden) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <Text variant="bodyMedium">Visit history is available to supervisors on the web app.</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Your recorded visits are saved on the server and visible to your supervisor.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.error}>{error}</Text>
            <Button onPress={load}>Retry</Button>
          </Card.Content>
        </Card>
      </ScrollView>
      </SafeAreaView>
    );
  }

  if (visits.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <Text variant="bodyMedium">No visits yet</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Record a visit from the Visits tab or Dashboard.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {visits.map((v) => {
        const activityLabel = (v.activity_type || '').replace(/_/g, ' ');
        const subtitle = [activityLabel, formatDateTime(v.created_at)].filter(Boolean).join(' · ');
        return (
          <ListItemRow
            key={v.id}
            avatarLetter={(v.farmer_display_name || v.farmer || '?').toString()}
            title={v.farmer_display_name ?? v.farmer ?? 'Unknown'}
            subtitle={subtitle}
            right={
              <View style={[styles.badge, { backgroundColor: visitStatusColor(v.verification_status || '') + '20' }]}>
                <Text variant="labelSmall" style={[styles.badgeText, { color: visitStatusColor(v.verification_status || '') }]}>
                  {visitStatusLabel(v)}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={14} color={visitStatusColor(v.verification_status || '')} />
              </View>
            }
            onPress={() => router.push({ pathname: '/(app)/visits/[id]', params: { id: v.id } })}
          />
        );
      })}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { ...cardStyle, ...cardShadow, marginBottom: spacing.md },
  muted: { marginTop: spacing.xs, opacity: 0.8 },
  error: { color: colors.error, marginBottom: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 2,
  },
  badgeText: { fontWeight: '600', fontSize: 12 },
});
