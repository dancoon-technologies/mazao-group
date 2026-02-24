import { api, type Farmer, type Schedule } from '@/lib/api';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Card, Text } from 'react-native-paper';

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
      <View style={styles.centered}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={styles.welcomeCard}>
        <Card.Content>
          <View style={styles.welcomeHeader}>
            <View>
              <Text variant="titleMedium">Welcome back</Text>
              <Text variant="bodySmall">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <Avatar.Icon size={40} icon="account" />
          </View>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Card.Content>
                <Text variant="bodySmall">Assigned farmers</Text>
                <Text variant="titleMedium">{farmers.length}</Text>
              </Card.Content>
            </Card>
            <Card style={styles.statCard}>
              <Card.Content>
                <Text variant="bodySmall">Today&apos;s schedules</Text>
                <Text variant="titleMedium">{todaySchedules.length}</Text>
              </Card.Content>
            </Card>
            <Card style={styles.statCard}>
              <Card.Content>
                <Text variant="bodySmall">Pending proposals</Text>
                <Text variant="titleMedium">{proposedCount}</Text>
              </Card.Content>
            </Card>
          </View>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Quick actions
      </Text>
      <View style={styles.quickActions}>
        <Card style={styles.quickCard} onPress={() => router.push('/(app)/(tabs)/visits')}>
          <Card.Content style={styles.quickCardContent}>
            <Avatar.Icon icon="clipboard-list" size={36} style={{ backgroundColor: '#e8f5e9' }} />
            <View>
              <Text variant="titleSmall">Schedules</Text>
              <Text variant="bodySmall">Record a visit</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.quickCard} onPress={() => router.push('/(app)/add-farmer')}>
          <Card.Content style={styles.quickCardContent}>
            <Avatar.Icon icon="account-plus" size={36} style={{ backgroundColor: '#e3f2fd' }} />
            <View>
              <Text variant="titleSmall">Add farmer</Text>
              <Text variant="bodySmall">Register farmer & farm</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.quickCard} onPress={() => router.push('/(app)/propose-schedule')}>
          <Card.Content style={styles.quickCardContent}>
            <Avatar.Icon icon="calendar-plus" size={36} style={{ backgroundColor: '#fff3e0' }} />
            <View>
              <Text variant="titleSmall">Propose schedule</Text>
              <Text variant="bodySmall">Request approval</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.quickCard} onPress={() => router.push('/(app)/(tabs)/history')}>
          <Card.Content style={styles.quickCardContent}>
            <Avatar.Icon icon="history" size={36} style={{ backgroundColor: '#f3e5f5' }} />
            <View>
              <Text variant="titleSmall">History</Text>
              <Text variant="bodySmall">View visits</Text>
            </View>
          </Card.Content>
        </Card>
      </View>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Today&apos;s schedules
      </Text>
      {todaySchedules.length === 0 ? (
        <Card style={styles.card}>
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
                ? router.push({ pathname: '/(app)/record-visit', params: { farmerId: s.farmer } })
                : router.push('/(app)/record-visit')
            }
          >
            <Card.Content>
              <Text variant="titleSmall">{s.farmer_display_name ?? 'No farmer assigned'}</Text>
              <Text variant="bodySmall">{formatDate(s.scheduled_date)} — {s.status}</Text>
            </Card.Content>
            <Card.Actions>
              <Text
                variant="labelLarge"
                style={styles.recordLink}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/record-visit',
                    params: s.farmer ? { farmerId: s.farmer } : {},
                  })
                }
              >
                Record visit
              </Text>
            </Card.Actions>
          </Card>
        ))
      )}

      {error ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.error}>
              {error}
            </Text>
          </Card.Content>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  welcomeCard: {
    backgroundColor: '#2e7d32',
    borderRadius: 12,
    padding: 2,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 90, borderRadius: 8 },
  sectionTitle: { marginTop: 24, marginBottom: 8 },
  quickActions: { gap: 8 },
  quickCard: { marginBottom: 8, borderRadius: 8 },
  quickCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { marginBottom: 8, borderRadius: 8 },
  muted: { marginTop: 4, opacity: 0.8 },
  recordLink: { color: '#2e7d32' },
  error: { color: '#b00020' },
});
