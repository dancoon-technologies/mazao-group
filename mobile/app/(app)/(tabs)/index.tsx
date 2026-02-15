import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { List, Button, Text, FAB, ActivityIndicator, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { api, type Farmer, type Schedule } from '@/lib/api';

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [f, s] = await Promise.all([api.getFarmers(), api.getSchedules()]);
      setFarmers(f);
      setSchedules(s);
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.error}>
              {error}
            </Text>
            <Button onPress={load}>Retry</Button>
          </Card.Content>
        </Card>
      ) : null}

      <List.Section>
        <List.Subheader>Today&apos;s schedules</List.Subheader>
        {todaySchedules.length === 0 ? (
          <List.Item title="No visits scheduled for today" />
        ) : (
          todaySchedules.map((s) => (
            <List.Item
              key={s.id}
              title={s.farmer_display_name ?? 'No farmer assigned'}
              description={formatDate(s.scheduled_date)}
              right={() => (
                <Button
                  mode="contained-tonal"
                  compact
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/record-visit',
                      params: s.farmer ? { farmerId: s.farmer } : {},
                    })
                  }
                  disabled={!s.farmer}>
                  Record
                </Button>
              )}
            />
          ))
        )}
      </List.Section>

      <List.Section>
        <List.Subheader>My assigned farmers</List.Subheader>
        {farmers.length === 0 ? (
          <List.Item title="No farmers assigned" />
        ) : (
          farmers.map((f) => (
            <List.Item
              key={f.id}
              title={f.display_name}
              description={f.crop_type || f.phone || '—'}
              right={() => (
                <Button
                  mode="contained-tonal"
                  compact
                  onPress={() =>
                    router.push({ pathname: '/(app)/record-visit', params: { farmerId: f.id } })
                  }>
                  Record visit
                </Button>
              )}
            />
          ))
        )}
      </List.Section>

      <FAB
        icon="camera"
        style={styles.fab}
        onPress={() => router.push('/(app)/record-visit')}
        label="Record visit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 80,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 16,
  },
  error: {
    color: '#b00020',
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#2e7d32',
  },
});
