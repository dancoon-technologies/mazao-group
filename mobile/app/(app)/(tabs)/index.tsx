import { api, type Farmer, type Schedule } from '@/lib/api';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Appbar,
  Surface,
  Text,
  Card,
  Button,
  FAB,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function HomeScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([api.getSchedules(), api.getFarmers()]);
      setSchedules(s);
      setFarmers(f);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todaySchedules = schedules.filter((s) => s.scheduled_date === today);
  const proposedCount = schedules.filter((s) => s.status === 'proposed').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Surface style={styles.surface} elevation={0}>
          <View style={styles.kpiRow}>
            <Card style={styles.kpiCard}>
              <Card.Content>
                <Text variant="headlineLarge">{farmers.length}</Text>
                <Text variant="bodyMedium">Assigned farmers</Text>
              </Card.Content>
            </Card>
            <Card style={styles.kpiCard}>
              <Card.Content>
                <Text variant="headlineLarge">{todaySchedules.length}</Text>
                <Text variant="bodyMedium">Visits today</Text>
              </Card.Content>
            </Card>
          </View>
          <View style={styles.kpiRow}>
            <Card style={styles.kpiCard}>
              <Card.Content>
                <Text variant="headlineLarge">{proposedCount}</Text>
                <Text variant="bodyMedium">Pending proposals</Text>
              </Card.Content>
            </Card>
            <View style={styles.kpiCardPlaceholder} />
          </View>

          <Divider style={styles.divider} />

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Quick actions
          </Text>
          <Button
            mode="contained"
            onPress={() => router.push('/(app)/record-visit')}
            style={styles.quickBtn}
            accessibilityLabel="Record visit"
          >
            Record Visit
          </Button>
          <Button
            mode="outlined"
            onPress={() => router.push('/(app)/add-farmer')}
            style={styles.quickBtn}
          >
            Add Farmer
          </Button>
          <Button
            mode="text"
            onPress={() => router.push('/(app)/propose-schedule')}
            style={styles.quickBtn}
          >
            Propose Schedule
          </Button>
          <Button
            mode="outlined"
            onPress={() => router.push('/(app)/(tabs)/visits')}
            style={styles.quickBtn}
          >
            Schedules
          </Button>
          <Button
            mode="text"
            onPress={() => router.push('/(app)/(tabs)/history')}
            style={styles.quickBtn}
          >
            History
          </Button>

          <Divider style={styles.divider} />

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Today&apos;s schedules
          </Text>
          {todaySchedules.length === 0 ? (
            <Card>
              <Card.Content>
                <Text variant="bodyMedium">No visits scheduled for today</Text>
                <Text variant="bodySmall" style={styles.muted}>
                  Propose a schedule or go to Visits to record one.
                </Text>
              </Card.Content>
            </Card>
          ) : (
            todaySchedules.map((s) => (
              <Card
                key={s.id}
                style={styles.card}
                onPress={() =>
                  s.farmer
                    ? router.push({
                        pathname: '/(app)/record-visit',
                        params: { farmerId: s.farmer },
                      })
                    : router.push('/(app)/record-visit')
                }
              >
                <Card.Content>
                  <Text variant="titleMedium">
                    {s.farmer_display_name ?? 'No farmer assigned'}
                  </Text>
                  <Text variant="bodySmall">
                    {formatDate(s.scheduled_date)} — {s.status}
                  </Text>
                </Card.Content>
                <Card.Actions>
                  <Button
                    mode="text"
                    compact
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/record-visit',
                        params: s.farmer ? { farmerId: s.farmer } : {},
                      })
                    }
                  >
                    Record visit
                  </Button>
                </Card.Actions>
              </Card>
            ))
          )}

          {error ? (
            <Card style={styles.errorCard}>
              <Card.Content>
                <Text variant="bodyMedium" style={styles.errorText}>
                  {error}
                </Text>
              </Card.Content>
            </Card>
          ) : null}
        </Surface>
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/(app)/record-visit')}
        label="Record"
        accessibilityLabel="Record visit"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { paddingBottom: 100 },
  surface: { padding: 16 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 16 },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: { flex: 1, minWidth: 0 },
  kpiCardPlaceholder: { flex: 1, minWidth: 0, opacity: 0 },
  divider: { marginVertical: 16 },
  sectionTitle: { marginBottom: 12 },
  quickBtn: { marginBottom: 8 },
  card: { marginBottom: 12 },
  muted: { marginTop: 4, opacity: 0.8 },
  errorCard: { marginTop: 12, borderWidth: 1, borderColor: 'rgb(239, 68, 68)' },
  errorText: { color: 'rgb(239, 68, 68)' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
});
