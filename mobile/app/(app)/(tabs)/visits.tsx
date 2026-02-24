import { api, type Schedule } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput, ActivityIndicator } from 'react-native-paper';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function VisitsScreen() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.getSchedules();
      setSchedules(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = schedules.filter(
    (s) =>
      s.farmer_display_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      (s.farmer?.toLowerCase().includes(search.toLowerCase())) ||
      s.notes?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="bodySmall" style={styles.hint}>
        Select a schedule to record a visit (GPS + photo). You can also record from Dashboard.
      </Text>
      <TextInput
        placeholder="Search schedules..."
        value={search}
        onChangeText={setSearch}
        mode="outlined"
        style={styles.search}
      />
      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : error ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.error}>{error}</Text>
            <Button onPress={load}>Retry</Button>
          </Card.Content>
        </Card>
      ) : filtered.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium">No schedules found</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Propose a schedule from Dashboard or ask your supervisor to assign one.
            </Text>
          </Card.Content>
        </Card>
      ) : (
        filtered.map((s) => (
          <Card key={s.id} style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text variant="titleMedium">{s.farmer_display_name ?? 'No farmer'}</Text>
                <Text variant="bodySmall" style={styles.status}>{s.status}</Text>
              </View>
              <Text variant="bodySmall">{formatDate(s.scheduled_date)}</Text>
              {s.notes ? <Text variant="bodySmall" style={styles.notes}>{s.notes}</Text> : null}
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  hint: { marginBottom: 12, opacity: 0.8 },
  search: { marginBottom: 16 },
  loader: { marginVertical: 24 },
  card: { marginBottom: 12, borderRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  status: { textTransform: 'capitalize', opacity: 0.8 },
  notes: { marginTop: 4, fontStyle: 'italic', opacity: 0.9 },
  muted: { marginTop: 4, opacity: 0.8 },
  error: { color: '#b00020', marginBottom: 8 },
});
