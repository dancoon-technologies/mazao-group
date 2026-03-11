/**
 * Edit a proposed schedule. Allowed only when scheduled date is not within 1 day (>= 2 days from today).
 * Officers can edit only their own proposed schedules.
 */
import { useAuth } from '@/contexts/AuthContext';
import { getFarmers as getFarmersDb, getFarms as getFarmsDb } from '@/database';
import { farmerRowToFarmer } from '@/lib/offline-helpers';
import { syncWithServer } from '@/lib/syncWithServer';
import { api, type Farm, type Farmer, type Schedule } from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Appbar, Button, Text, TextInput, ActivityIndicator, Banner, Snackbar } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SelectFarmerModal } from '@/components/SelectFarmerModal';
import { isScheduleEditableByDate } from '@/lib/format';
import { appbarHeight, colors, scrollPaddingKeyboard } from '@/constants/theme';

export default function EditScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheduleId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  const { userId } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [farmerModalOpen, setFarmerModalOpen] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const load = useCallback(async () => {
    if (!scheduleId) return;
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    try {
      const [schedulesList, farmersList] = await Promise.all([
        api.getSchedules(),
        connected ? api.getFarmers() : getFarmersDb().then((rows) => rows.map(farmerRowToFarmer)),
      ]);
      const s = (schedulesList as Schedule[]).find((sch) => sch.id === scheduleId);
      if (!s) {
        setError('Schedule not found.');
        setSchedule(null);
        setLoading(false);
        return;
      }
      if (s.status !== 'proposed') {
        setError('Only proposed schedules can be edited.');
        setSchedule(null);
        setLoading(false);
        return;
      }
      if (!isScheduleEditableByDate(s.scheduled_date)) {
        setError('Cannot edit when within 1 day of the scheduled date.');
        setSchedule(null);
        setLoading(false);
        return;
      }
      if (s.officer !== userId) {
        setError('You can only edit your own proposed schedules.');
        setSchedule(null);
        setLoading(false);
        return;
      }
      setSchedule(s);
      setFarmers(Array.isArray(farmersList) ? farmersList : []);
      setSelectedDate(s.scheduled_date.slice(0, 10));
      setSelectedFarmerId(s.farmer ?? null);
      setSelectedFarmId(s.farm ?? null);
      setNotes(s.notes ?? '');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule');
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [scheduleId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedFarmerId) {
      setFarms([]);
      setSelectedFarmId(null);
      return;
    }
    let cancelled = false;
    const loadFarms = async () => {
      try {
        const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
        const list = connected
          ? await api.getFarms(selectedFarmerId)
          : (await getFarmsDb(selectedFarmerId)).map((r) => ({
              id: r.id,
              farmer: r.farmer_id,
              village: r.village,
              latitude: r.latitude,
              longitude: r.longitude,
            }));
        if (!cancelled) setFarms(list);
      } catch {
        if (!cancelled) setFarms([]);
      }
    };
    loadFarms();
    return () => { cancelled = true; };
  }, [selectedFarmerId]);

  const submit = useCallback(async () => {
    if (!scheduleId || !schedule) return;
    const dateStr = selectedDate?.trim() ?? '';
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      setError('Enter date as YYYY-MM-DD.');
      return;
    }
    if (!isScheduleEditableByDate(dateStr)) {
      setError('New date must be at least two days from today.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.updateSchedule(scheduleId, {
        scheduled_date: dateStr,
        farmer: selectedFarmerId ?? null,
        farm: selectedFarmId ?? null,
        notes: notes.trim() || undefined,
      });
      await syncWithServer().catch(() => {});
      setSnackbarVisible(true);
      setTimeout(() => {
        router.back();
      }, 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update schedule');
    } finally {
      setSubmitting(false);
    }
  }, [scheduleId, schedule, selectedDate, selectedFarmerId, selectedFarmId, notes, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Edit schedule" />
        </Appbar.Header>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !schedule) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Edit schedule" />
        </Appbar.Header>
        <Banner visible actions={[{ label: 'OK', onPress: () => router.back() }]} style={styles.banner}>
          {error}
        </Banner>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Edit schedule" />
      </Appbar.Header>
      {error ? (
        <Banner visible actions={[{ label: 'Dismiss', onPress: () => setError('') }]} style={styles.banner}>
          {error}
        </Banner>
      ) : null}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + appbarHeight}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: scrollPaddingKeyboard + Math.max(insets.bottom, 24), flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text variant="bodySmall" style={styles.hint}>
            You can edit date, farmer, farm, and notes. Schedule must be at least 2 days from today.
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
          <Button
            mode="outlined"
            onPress={() => setFarmerModalOpen(true)}
            style={styles.farmerSelectBtn}
            contentStyle={styles.farmerSelectBtnContent}
            icon="account-search"
          >
            {selectedFarmerId
              ? (farmers.find((f) => f.id === selectedFarmerId)?.display_name ?? 'Farmer selected')
              : 'Select farmer'}
          </Button>
          <Button
            mode="text"
            compact
            icon="account-plus"
            onPress={() => router.push({ pathname: '/(app)/add-farmer', params: { returnTo: 'edit-schedule' } })}
            style={styles.addFarmerLink}
          >
            Add new farmer
          </Button>
          <SelectFarmerModal
            visible={farmerModalOpen}
            onClose={() => setFarmerModalOpen(false)}
            farmers={farmers}
            selectedFarmerId={selectedFarmerId}
            onSelect={setSelectedFarmerId}
            title="Select farmer"
          />

          {selectedFarmerId && (
            <>
              <Text variant="labelLarge" style={styles.label}>Farm (optional)</Text>
              <View style={styles.chipRow}>
                <Button
                  mode={selectedFarmId === null ? 'contained' : 'outlined'}
                  compact
                  onPress={() => setSelectedFarmId(null)}
                  style={styles.chip}
                >
                  None
                </Button>
                {farms.map((farm) => (
                  <Button
                    key={farm.id}
                    mode={selectedFarmId === farm.id ? 'contained' : 'outlined'}
                    compact
                    onPress={() => setSelectedFarmId(farm.id)}
                    style={styles.chip}
                  >
                    {farm.village}
                  </Button>
                ))}
                {farms.length === 0 && (
                  <Text variant="bodySmall" style={styles.muted}>No farms for this farmer</Text>
                )}
              </View>
            </>
          )}

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
            <Button mode="contained" onPress={submit} loading={submitting} disabled={submitting || !selectedDate}>
              Save changes
            </Button>
            <Button mode="text" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        wrapperStyle={{ position: 'absolute', left: 0, right: 0, top: insets.top }}
        style={{ backgroundColor: colors.primary }}
      >
        Changes saved. Your supervisor must accept the schedule for it to take effect.
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
  hint: { marginBottom: 16, opacity: 0.8 },
  label: { marginTop: 12, marginBottom: 4 },
  input: { marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { margin: 0 },
  farmerSelectBtn: { marginBottom: 4 },
  farmerSelectBtnContent: { justifyContent: 'flex-start' },
  addFarmerLink: { marginBottom: 8 },
  banner: { backgroundColor: '#ffebee' },
  actions: { gap: 8, marginTop: 20 },
  muted: { opacity: 0.7 },
});
