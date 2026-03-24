import { ListItemRow } from '@/components/ListItemRow';
import { SelectActivityTypesModal } from '@/components/SelectActivityTypesModal';
import { SelectFarmerModal } from '@/components/SelectFarmerModal';
import { SelectFarmModal } from '@/components/SelectFarmModal';
import { appbarHeight, colors, scrollPaddingKeyboard, spacing } from '@/constants/theme';
import { getFarmers as getFarmersDb, getFarms as getFarmsDb } from '@/database';
import { farmerRowToFarmer, farmRowToFarm } from '@/lib/offline-helpers';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';
import { api, getLabels, type ActivityTypeOption, type Farm, type Farmer, type Route } from '@/lib/api';
import { appMeta$ } from '@/store/observable';
import { useSelector } from '@legendapp/state/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Appbar, Banner, Button, HelperText, IconButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface StopEntry {
  farmer_id: string;
  farm_id: string | null;
  farmer_display_name: string;
  farm_display_name: string | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + 'Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function RouteFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date: string; routeId?: string; officerId?: string }>();
  const date = (params.date ?? '').trim();
  const routeId = params.routeId;
  const officerIdParam = typeof params.officerId === 'string' ? params.officerId : undefined;
  const { role } = useAuth();
  const assigner = role === 'admin' || role === 'supervisor';

  const [route, setRoute] = useState<Route | null>(null);
  const [name, setName] = useState('');
  const [activityTypes, setActivityTypes] = useState<string[]>([DEFAULT_ACTIVITY_TYPE]);
  const [notes, setNotes] = useState('');
  const [stops, setStops] = useState<StopEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [farmerModalOpen, setFarmerModalOpen] = useState(false);
  const [farmModalOpen, setFarmModalOpen] = useState(false);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [pendingFarmerId, setPendingFarmerId] = useState<string | null>(null);

  const options = useSelector(() => appMeta$.cachedOptions.get());
  const activityTypeOptions: ActivityTypeOption[] = options?.activity_types ?? [];
  const labels = useSelector(() => getLabels(options));

  const loadRoute = useCallback(async () => {
    if (!routeId) {
      setRoute(null);
      setName('');
      setActivityTypes([DEFAULT_ACTIVITY_TYPE]);
      setNotes('');
      setStops([]);
      setLoading(false);
      return;
    }
    try {
      const list = await api.getRoutes({});
      const found = list.find((r) => r.id === routeId);
      if (found) {
        setRoute(found);
        setName(found.name ?? '');
        setActivityTypes(
          found.activity_types?.length ? found.activity_types : [DEFAULT_ACTIVITY_TYPE]
        );
        setNotes(found.notes ?? '');
        setStops(
          (found.stops ?? []).map((s) => ({
            farmer_id: s.farmer,
            farm_id: s.farm,
            farmer_display_name: s.farmer_display_name ?? '',
            farm_display_name: s.farm_display_name ?? null,
          }))
        );
      } else {
        setRoute(null);
        setError('Route not found.');
      }
    } catch {
      setError('Failed to load route.');
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
      if (connected) {
        try {
          const f = await api.getFarmers();
          if (!cancelled) setFarmers(Array.isArray(f) ? f : []);
        } catch {
          const rows = await getFarmersDb();
          if (!cancelled) setFarmers(rows.map(farmerRowToFarmer));
        }
      } else {
        const rows = await getFarmersDb();
        if (!cancelled) setFarmers(rows.map(farmerRowToFarmer));
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!pendingFarmerId) {
      setFarms([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
        if (connected) {
          const list = await api.getFarms(pendingFarmerId);
          if (!cancelled) setFarms(Array.isArray(list) ? list : []);
        } else {
          const rows = await getFarmsDb(pendingFarmerId);
          if (!cancelled) setFarms(rows.map(farmRowToFarm));
        }
      } catch {
        if (!cancelled) setFarms([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [pendingFarmerId]);

  const handleAddFarmer = useCallback((farmerId: string | null) => {
    setFarmerModalOpen(false);
    if (!farmerId) return;
    const farmer = farmers.find((f) => f.id === farmerId);
    setPendingFarmerId(farmerId);
    setFarmModalOpen(true);
  }, [farmers]);

  const addStopForFarmerAndFarm = useCallback(
    (farmerId: string, farmId: string | null) => {
      const farmer = farmers.find((f) => f.id === farmerId);
      const farm = farmId ? farms.find((f) => f.id === farmId) : null;
      setStops((prev) => [
        ...prev,
        {
          farmer_id: farmerId,
          farm_id: farmId ?? null,
          farmer_display_name: farmer?.display_name ?? farmer?.first_name ?? '',
          farm_display_name: farm?.village ?? null,
        },
      ]);
      setPendingFarmerId(null);
    },
    [farmers, farms]
  );

  const handleAddFarm = useCallback(
    (farmId: string | null) => {
      setFarmModalOpen(false);
      if (!pendingFarmerId) return;
      addStopForFarmerAndFarm(pendingFarmerId, farmId);
    },
    [pendingFarmerId, addStopForFarmerAndFarm]
  );

  const handleCloseFarmModal = useCallback(() => {
    setFarmModalOpen(false);
    if (pendingFarmerId) {
      addStopForFarmerAndFarm(pendingFarmerId, null);
    }
    setPendingFarmerId(null);
  }, [pendingFarmerId, addStopForFarmerAndFarm]);

  const removeStop = useCallback((index: number) => {
    setStops((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const save = useCallback(async () => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Invalid date.');
      return;
    }
    if (activityTypes.length === 0) {
      setError('Select at least one activity type (tap Select activities).');
      return;
    }
    const incompleteStop = stops.find((s) => !String(s.farmer_id ?? '').trim());
    if (incompleteStop) {
      setError('Each stop must have a customer. Remove incomplete stops or finish adding them.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        scheduled_date: date,
        name: name.trim(),
        activity_types: activityTypes,
        notes: notes.trim(),
        stops: stops.map((s, i) => ({ farmer_id: s.farmer_id, farm_id: s.farm_id, order: i })),
      };
      if (routeId) {
        await api.updateRoute(routeId, payload);
        router.back();
      } else {
        await api.createRoute({
          ...payload,
          ...(assigner && officerIdParam ? { officer: officerIdParam } : {}),
        });
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save route.');
    } finally {
      setSaving(false);
    }
  }, [date, name, activityTypes, notes, stops, routeId, router]);

  const deleteRoute = useCallback(async () => {
    if (!routeId) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteRoute(routeId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete.');
    } finally {
      setSaving(false);
    }
  }, [routeId, router]);

  if (!date) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Route" />
        </Appbar.Header>
        <View style={styles.centered}>
          <Text>Missing date.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Route" />
        </Appbar.Header>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={routeId ? 'Edit route' : 'Add route'} />
      </Appbar.Header>

      {error ? (
        <Banner visible actions={[{ label: 'Dismiss', onPress: () => setError('') }]} style={styles.banner}>
          {error}
        </Banner>
      ) : null}

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={appbarHeight + insets.top}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: scrollPaddingKeyboard + insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="labelLarge" style={styles.dateLabel}>{formatDate(date)}</Text>

          <Text variant="labelMedium" style={styles.fieldLabel}>Route name (optional)</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            mode="outlined"
            placeholder="e.g. Eastern circuit"
            style={styles.input}
          />

          <Text variant="labelMedium" style={styles.fieldLabel}>Activity types *</Text>
          <Text variant="bodySmall" style={styles.hint}>
            Applies to the whole route for this day. Defaults to one activity; change if needed.
          </Text>
          <Button mode="outlined" onPress={() => setActivityModalOpen(true)} style={styles.selectBtn}>
            {activityTypes.length === 0 ? 'Select activities' : `${activityTypes.length} selected`}
          </Button>
          {activityTypes.length === 0 ? (
            <HelperText type="error" visible padding="normal">
              Choose at least one activity type.
            </HelperText>
          ) : null}

          <Text variant="labelMedium" style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.input}
          />

          <Text variant="labelMedium" style={styles.fieldLabel}>Stops ({labels.partner}s / locations)</Text>
          <Text variant="bodySmall" style={styles.hint}>Add the customers you plan to visit on this day, in order.</Text>
          {stops.map((s, i) => (
            <View key={`${s.farmer_id}-${s.farm_id ?? 'n'}-${i}`} style={styles.stopRow}>
              <ListItemRow
                avatarLetter={(s.farmer_display_name || '?').charAt(0)}
                title={s.farmer_display_name}
                subtitle={s.farm_display_name ? `${labels.location}: ${s.farm_display_name}` : undefined}
              />
              <IconButton icon="close" size={22} onPress={() => removeStop(i)} />
            </View>
          ))}
          <Button mode="outlined" icon="plus" onPress={() => setFarmerModalOpen(true)} style={styles.addStopBtn}>
            Add stop
          </Button>

          <View style={styles.actions}>
            <Button mode="contained" onPress={save} loading={saving} disabled={saving} style={styles.saveBtn}>
              {routeId ? 'Save route' : 'Create route'}
            </Button>
            {routeId && (
              <Button mode="outlined" onPress={deleteRoute} disabled={saving} style={styles.deleteBtn}>
                Delete route
              </Button>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectActivityTypesModal
        visible={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        options={activityTypeOptions}
        selectedValues={activityTypes}
        onSelect={setActivityTypes}
        title="Activities for this route"
      />

      <SelectFarmerModal
        visible={farmerModalOpen}
        onClose={() => setFarmerModalOpen(false)}
        onSelect={handleAddFarmer}
        farmers={farmers}
        selectedFarmerId={null}
        title={`Select ${labels.partner.toLowerCase()}`}
      />

      <SelectFarmModal
        visible={farmModalOpen}
        onClose={handleCloseFarmModal}
        farms={farms}
        onSelect={handleAddFarm}
        selectedFarmId={null}
        title={`Select ${labels.location.toLowerCase()} (optional)`}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  appbar: { backgroundColor: colors.background },
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner: { backgroundColor: colors.error },
  dateLabel: { marginBottom: spacing.md, fontWeight: '700', color: colors.gray900 },
  fieldLabel: { marginTop: spacing.md, marginBottom: spacing.xs, color: colors.gray700 },
  hint: { color: colors.gray900, marginBottom: spacing.sm },
  input: { marginBottom: spacing.sm },
  selectBtn: { marginBottom: spacing.sm },
  stopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  addStopBtn: { marginTop: spacing.sm, marginBottom: spacing.lg },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  saveBtn: {},
  deleteBtn: { borderColor: colors.error },
});
