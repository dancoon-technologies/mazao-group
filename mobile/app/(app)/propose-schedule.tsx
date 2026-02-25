import { api, type Farmer, type Schedule } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Appbar,
  Button,
  Text,
  TextInput,
  ActivityIndicator,
  Card,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ProposeScheduleScreen() {
  const router = useRouter();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

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
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (!selectedDate) setSelectedDate(today);
  }, [selectedDate]);

  const submit = useCallback(async () => {
    if (!selectedDate) {
      setError('Select a date.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.createSchedule({
        farmer: selectedFarmerId || undefined,
        scheduled_date: selectedDate,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to propose schedule');
    } finally {
      setSubmitting(false);
    }
  }, [selectedDate, selectedFarmerId, notes, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Propose schedule" />
        </Appbar.Header>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Propose schedule" />
      </Appbar.Header>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="bodyMedium" style={styles.hint}>
            Your supervisor will accept or reject the proposal.
          </Text>

          <Text variant="labelLarge" style={styles.label}>Scheduled date *</Text>
          <TextInput
            label="Date"
            value={selectedDate}
            onChangeText={setSelectedDate}
            mode="outlined"
            placeholder="YYYY-MM-DD"
            style={styles.input}
            keyboardType="numbers-and-punctuation"
          />

          <Text variant="labelLarge" style={styles.label}>Farmer (optional)</Text>
          <View style={styles.chipRow}>
            <Button
              mode={selectedFarmerId === null ? 'contained' : 'outlined'}
              compact
              onPress={() => setSelectedFarmerId(null)}
              style={styles.chip}
            >
              No farmer
            </Button>
            {farmers.map((f) => (
              <Button
                key={f.id}
                mode={selectedFarmerId === f.id ? 'contained' : 'outlined'}
                compact
                onPress={() => setSelectedFarmerId(f.id)}
                style={styles.chip}
              >
                {f.display_name}
              </Button>
            ))}
          </View>

          <Text variant="labelLarge" style={styles.label}>Notes</Text>
          <TextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={submit}
              loading={submitting}
              disabled={submitting || !selectedDate}
            >
              Propose schedule
            </Button>
            <Button mode="text" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            My recent schedules
          </Text>
          {schedules.length === 0 ? (
            <Text variant="bodySmall" style={styles.muted}>No schedules yet</Text>
          ) : (
            schedules.slice(0, 10).map((s) => (
              <Card key={s.id} style={styles.scheduleCard}>
                <Card.Content>
                  <Text variant="bodyMedium">
                    {formatDate(s.scheduled_date)} — {s.farmer_display_name ?? 'No farmer'}
                  </Text>
                  <Text variant="bodySmall" style={styles.status}>{s.status}</Text>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { marginTop: 20, marginBottom: 8 },
  hint: { marginBottom: 16, opacity: 0.8 },
  label: { marginTop: 12, marginBottom: 4 },
  input: { marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { margin: 0 },
  error: { color: '#b00020', marginVertical: 8 },
  actions: { gap: 8, marginTop: 20 },
  scheduleCard: { marginBottom: 8 },
  status: { textTransform: 'capitalize', opacity: 0.8, marginTop: 2 },
  muted: { opacity: 0.7 },
});
