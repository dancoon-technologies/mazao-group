import { api, type Visit } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Text, Button } from 'react-native-paper';

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
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await api.getVisits();
      setVisits(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
        setForbidden(true);
        setVisits([]);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (forbidden) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium">Visit history is available to supervisors on the web app.</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Your recorded visits are saved on the server and visible to your supervisor.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.error}>{error}</Text>
            <Button onPress={load}>Retry</Button>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  if (visits.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium">No visits yet</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Record a visit from the Visits tab or Dashboard.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {visits.map((v) => (
        <Card key={v.id} style={styles.card}>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 12, borderRadius: 8 },
  muted: { marginTop: 4, opacity: 0.8 },
  error: { color: '#b00020', marginBottom: 8 },
  activity: { marginTop: 2, textTransform: 'capitalize', opacity: 0.9 },
  verified: { marginTop: 2, textTransform: 'capitalize', color: '#2e7d32' },
});
