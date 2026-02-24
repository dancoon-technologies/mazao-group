import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { api, type Farmer, type Schedule } from '@/lib/api';

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
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Propose a visit schedule
      </Text>
      <Text variant="bodySmall" style={styles.hint}>
        Your supervisor will accept or reject the proposal.
      </Text>

      <Text variant="labelLarge" style={styles.label}>Date *</Text>
      <TextInput
        label="Scheduled date"
        value={selectedDate}
        onChangeText={setSelectedDate}
        mode="outlined"
        placeholder="YYYY-MM-DD"
        style={styles.input}
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

      <TextInput
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        mode="outlined"
        multiline
        numberOfLines={2}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button mode="contained" onPress={submit} loading={submitting} disabled={submitting || !selectedDate}>
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
          <View key={s.id} style={styles.scheduleRow}>
            <Text variant="bodyMedium">
              {formatDate(s.scheduled_date)} — {s.farmer_display_name ?? 'No farmer'}
            </Text>
            <Text variant="bodySmall" style={styles.status}>{s.status}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { marginTop: 16, marginBottom: 8 },
  hint: { marginBottom: 12, opacity: 0.8 },
  label: { marginTop: 8, marginBottom: 4 },
  input: { marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { margin: 0 },
  error: { color: '#b00020', marginVertical: 8 },
  actions: { gap: 8, marginTop: 16 },
  scheduleRow: { marginBottom: 8, paddingVertical: 4 },
  status: { textTransform: 'capitalize', opacity: 0.8 },
  muted: { opacity: 0.7 },
});
