import { useAuth } from '@/contexts/AuthContext';
import { api, type Farmer, type Officer, type Schedule } from '@/lib/api';
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
  Menu,
  Snackbar,
  Banner,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const isAssigner = (role: string | null) => role === 'admin' || role === 'supervisor';

export default function ProposeScheduleScreen() {
  const router = useRouter();
  const { userId, role } = useAuth();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [officerMenuOpen, setOfficerMenuOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const assigner = isAssigner(role);

  const showSnackbar = useCallback((type: 'success' | 'error', text: string) => {
    setSnackbarMsg({ type, text });
    setSnackbarVisible(true);
  }, []);

  const dismissSnackbar = useCallback(() => {
    setSnackbarVisible(false);
    setSnackbarMsg(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const [f, s] = await Promise.all([api.getFarmers(), api.getSchedules()]);
      setFarmers(f);
      setSchedules(s);
      setError('');
      if (assigner) {
        const o = await api.getOfficers().catch(() => []);
        setOfficers(Array.isArray(o) ? o : []);
      } else {
        setOfficers([]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      setError(msg);
      showSnackbar('error', msg);
    } finally {
      setLoading(false);
    }
  }, [assigner, showSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (!selectedDate) setSelectedDate(today);
  }, [selectedDate]);

  const submit = useCallback(async () => {
    const dateStr = selectedDate?.trim() ?? '';
    if (!dateStr) {
      setError('Select a date.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      setError('Enter date as YYYY-MM-DD (e.g. 2026-02-25).');
      return;
    }
    if (assigner && !selectedOfficerId) {
      const msg = 'Select an extension officer to assign this schedule to.';
      setError(msg);
      showSnackbar('error', msg);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.createSchedule({
        officer: assigner ? selectedOfficerId! : (userId ?? undefined),
        farmer: selectedFarmerId || null,
        scheduled_date: dateStr,
        notes: (notes?.trim() ?? '') || undefined,
      });
      showSnackbar('success', assigner ? 'Schedule assigned successfully.' : 'Schedule proposed successfully.');
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to propose schedule';
      setError(message);
      showSnackbar('error', message);
    } finally {
      setSubmitting(false);
    }
  }, [assigner, userId, role, selectedDate, selectedOfficerId, selectedFarmerId, notes, router, showSnackbar]);

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
      {error ? (
        <Banner
          visible
          actions={[{ label: 'Dismiss', onPress: () => setError('') }]}
          style={styles.banner}
        >
          {error}
        </Banner>
      ) : null}
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
            {assigner
              ? 'Assign a visit to an extension officer. The schedule is accepted immediately.'
              : 'Your supervisor will accept or reject the proposal. The schedule is for you (logged-in user).'}
          </Text>

          {assigner && (
            <>
              <Text variant="labelLarge" style={styles.label}>Assign to officer *</Text>
              <Menu
                visible={officerMenuOpen}
                onDismiss={() => setOfficerMenuOpen(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setOfficerMenuOpen(true)}
                    style={styles.input}
                    contentStyle={styles.menuButtonContent}
                  >
                    {selectedOfficerId
                      ? (officers.find((o) => o.id === selectedOfficerId)?.display_name || officers.find((o) => o.id === selectedOfficerId)?.email || 'Select officer')
                      : 'Select officer'}
                  </Button>
                }
              >
                {officers.map((o) => (
                  <Menu.Item
                    key={o.id}
                    onPress={() => {
                      setSelectedOfficerId(o.id);
                      setOfficerMenuOpen(false);
                    }}
                    title={o.display_name || o.email}
                  />
                ))}
                {officers.length === 0 && (
                  <Menu.Item onPress={() => setOfficerMenuOpen(false)} title="No officers available" />
                )}
              </Menu>
            </>
          )}

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

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={submit}
              loading={submitting}
              disabled={submitting || !selectedDate || (assigner && !selectedOfficerId)}
            >
              {assigner ? 'Assign schedule' : 'Propose schedule'}
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

      <Snackbar
        visible={snackbarVisible}
        onDismiss={dismissSnackbar}
        duration={snackbarMsg?.type === 'success' ? 2500 : 5000}
        action={snackbarMsg?.type === 'error' ? { label: 'Dismiss', onPress: dismissSnackbar, textColor: colors.white } : undefined}
        style={[styles.snackbarTop, snackbarMsg?.type === 'error' ? styles.snackbarError : styles.snackbarGreen]}
        theme={{ colors: { surface: snackbarMsg?.type === 'error' ? colors.error : colors.primary, onSurface: colors.white } }}
      >
        {snackbarMsg?.text}
      </Snackbar>
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
  menuButtonContent: { justifyContent: 'flex-start' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { margin: 0 },
  banner: { backgroundColor: '#ffebee' },
  snackbarTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  snackbarGreen: { backgroundColor: colors.primary },
  snackbarError: { backgroundColor: colors.error },
  actions: { gap: 8, marginTop: 20 },
  scheduleCard: { marginBottom: 8 },
  status: { textTransform: 'capitalize', opacity: 0.8, marginTop: 2 },
  muted: { opacity: 0.7 },
});
