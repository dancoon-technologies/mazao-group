import { useAuth } from '@/contexts/AuthContext';
import { getFarmers as getFarmersDb, getFarms as getFarmsDb, getAllSchedulesForOfficer } from '@/database';
import { farmerRowToFarmer, scheduleRowToSchedule } from '@/lib/offline-helpers';
import { enqueueSchedule } from '@/lib/syncWithServer';
import { api, type Farm, type Farmer, type Officer, type Schedule } from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
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
  Menu,
  Snackbar,
  Banner,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListItemRow } from '@/components/ListItemRow';
import { SelectFarmerModal } from '@/components/SelectFarmerModal';
import { SelectFarmModal } from '@/components/SelectFarmModal';
import { appbarHeight, cardShadow, cardStyle, colors, scrollPaddingKeyboard } from '@/constants/theme';

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
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{ selectedFarmerId?: string }>();
  const { userId, role } = useAuth();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [officerMenuOpen, setOfficerMenuOpen] = useState(false);
  const [farmerModalOpen, setFarmerModalOpen] = useState(false);
  const [farmModalOpen, setFarmModalOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const assigner = isAssigner(role);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? false));
    return () => sub();
  }, []);

  const showSnackbar = useCallback((type: 'success' | 'error', text: string) => {
    setSnackbarMsg({ type, text });
    setSnackbarVisible(true);
  }, []);

  const dismissSnackbar = useCallback(() => {
    setSnackbarVisible(false);
    setSnackbarMsg(null);
  }, []);

  const loadFromDb = useCallback(async () => {
    if (!userId) return;
    const [farmerRows, scheduleRows] = await Promise.all([
      getFarmersDb(),
      getAllSchedulesForOfficer(userId),
    ]);
    setFarmers(farmerRows.map(farmerRowToFarmer));
    setSchedules(scheduleRows.map(scheduleRowToSchedule));
    setOfficers([]);
    setError('');
  }, [userId]);

  const load = useCallback(async () => {
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected) {
      try {
        const [f, s] = await Promise.all([api.getFarmers(), api.getSchedules()]);
        setFarmers(Array.isArray(f) ? f : []);
        setSchedules(Array.isArray(s) ? s : []);
        setError('');
        if (assigner) {
          const o = await api.getOfficers().catch(() => []);
          setOfficers(Array.isArray(o) ? o : []);
        } else {
          setOfficers([]);
        }
      } catch (e) {
        if (userId) {
          await loadFromDb();
        } else {
          const msg = e instanceof Error ? e.message : 'Failed to load';
          setError(msg);
          showSnackbar('error', msg);
        }
      }
    } else if (userId) {
      await loadFromDb();
    }
    setLoading(false);
  }, [assigner, userId, loadFromDb, showSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (!selectedDate) setSelectedDate(today);
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      const id = searchParams.selectedFarmerId;
      load().then(() => {
        if (id) setSelectedFarmerId(id);
      });
    }, [searchParams.selectedFarmerId, load])
  );

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
          : (await getFarmsDb(selectedFarmerId)).map((r) => ({ id: r.id, farmer: r.farmer_id, village: r.village, latitude: r.latitude, longitude: r.longitude }));
        if (!cancelled) setFarms(list);
      } catch {
        if (!cancelled) setFarms([]);
      }
    };
    loadFarms();
    return () => { cancelled = true; };
  }, [selectedFarmerId]);

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
        farm: selectedFarmId || null,
        scheduled_date: dateStr,
        notes: (notes?.trim() ?? '') || undefined,
      });
      showSnackbar('success', assigner ? 'Schedule assigned successfully.' : 'Schedule proposed successfully.');
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      if (isOnline === false || isOnline === null) {
        try {
          await enqueueSchedule({
            officer: assigner ? selectedOfficerId ?? undefined : (userId ?? undefined),
            farmer: selectedFarmerId || null,
            farm: selectedFarmId || null,
            scheduled_date: dateStr,
            notes: (notes?.trim() ?? '') || undefined,
          });
          showSnackbar('success', 'Saved for sync when back online.');
          setTimeout(() => router.back(), 1500);
        } catch (enqErr) {
          setError(enqErr instanceof Error ? enqErr.message : 'Failed to save for sync');
          showSnackbar('error', enqErr instanceof Error ? enqErr.message : 'Failed to save for sync');
        }
      } else {
        const message = e instanceof Error ? e.message : 'Failed to propose schedule';
        setError(message);
        showSnackbar('error', message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [assigner, userId, selectedDate, selectedOfficerId, selectedFarmerId, notes, router, showSnackbar, isOnline]);

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + appbarHeight}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: scrollPaddingKeyboard + Math.max(insets.bottom, 24), flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
                    title={o.display_name && o.email ? `${o.display_name} · ${o.email}` : (o.display_name || o.email)}
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
            onPress={() => router.push({ pathname: '/(app)/add-farmer', params: { returnTo: 'propose-schedule' } })}
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
              {farms.length === 0 ? (
                <Text variant="bodySmall" style={styles.muted}>No farms for this farmer</Text>
              ) : (
                <>
                  <Button
                    mode="outlined"
                    onPress={() => setFarmModalOpen(true)}
                    style={styles.farmerSelectBtn}
                    contentStyle={styles.farmerSelectBtnContent}
                    icon="barn"
                  >
                    {selectedFarm
                      ? `${selectedFarm.village}${selectedFarm.crop_type ? ` · ${selectedFarm.crop_type}` : ''}`
                      : 'Select farm'}
                  </Button>
                  <SelectFarmModal
                    visible={farmModalOpen}
                    onClose={() => setFarmModalOpen(false)}
                    farms={farms}
                    selectedFarmId={selectedFarmId}
                    onSelect={setSelectedFarmId}
                    title="Select farm"
                  />
                </>
              )}
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
            schedules.slice(0, 10).map((s) => {
              const displayName = s.farmer_display_name ?? farmers.find((f) => f.id === s.farmer)?.display_name ?? 'No farmer assigned';
              return (
                <ListItemRow
                  key={s.id}
                  avatarLetter={(displayName || '?').charAt(0)}
                  title={displayName}
                  subtitle={`${formatDate(s.scheduled_date)} · Farm: ${s.farm_display_name ?? 'None'} · ${s.status}`}
                />
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={dismissSnackbar}
        duration={snackbarMsg?.type === 'success' ? 2500 : 5000}
        action={snackbarMsg?.type === 'error' ? { label: 'Dismiss', onPress: dismissSnackbar, textColor: colors.white } : undefined}
        wrapperStyle={[styles.snackbarWrapper, { top: insets.top }]}
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
  farmerSelectBtn: { marginBottom: 4 },
  farmerSelectBtnContent: { justifyContent: 'flex-start' },
  addFarmerLink: { marginBottom: 8 },
  banner: { backgroundColor: '#ffebee' },
  snackbarWrapper: { position: 'absolute', left: 0, right: 0 },
  snackbarTop: { marginHorizontal: 0 },
  snackbarGreen: { backgroundColor: colors.primary },
  snackbarError: { backgroundColor: colors.error },
  actions: { gap: 8, marginTop: 20 },
  muted: { opacity: 0.7 },
});
