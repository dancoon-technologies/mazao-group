import { useAuth } from '@/contexts/AuthContext';
import { getVisitsForOfficer } from '@/database';
import { visitRowToVisit } from '@/lib/offline-helpers';
import { api, type Visit } from '@/lib/api';
import { useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Card, Text, Button } from 'react-native-paper';
import { colors, radius, spacing } from '@/constants/theme';

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

export default function HistoryScreen() {
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
      {visits.map((v) => (
        <Card key={v.id} style={styles.card} elevation={0}>
          <Card.Content>
            <Text variant="titleSmall">{v.farmer_display_name ?? v.farmer}</Text>
            <Text variant="bodySmall">{formatDateTime(v.created_at)}</Text>
            {v.activity_type ? (
              <Text variant="bodySmall" style={styles.activity}>
                {v.activity_type.replace(/_/g, ' ')}
              </Text>
            ) : null}
            {v.verification_status ? (
              <Text variant="bodySmall" style={styles.verified}>
                {v.verification_status}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: spacing.md, borderRadius: radius.sm },
  muted: { marginTop: spacing.xs, opacity: 0.8 },
  error: { color: colors.error, marginBottom: spacing.sm },
  activity: { marginTop: 2, textTransform: 'capitalize', opacity: 0.9 },
  verified: { marginTop: 2, textTransform: 'capitalize', color: colors.success },
});
