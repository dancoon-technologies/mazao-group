import { SelectActivityTypesModal } from '@/components/SelectActivityTypesModal';
import { appbarHeight, colors, scrollPaddingKeyboard, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { ACTIVITY_TYPES, DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';
import { api, type ActivityTypeOption } from '@/lib/api';
import { appMeta$, routesCache$ } from '@/store/observable';
import { useSelector } from '@legendapp/state/react';
import NetInfo from '@react-native-community/netinfo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Appbar, Banner, Button, HelperText, Text, TextInput } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { logger } from '@/lib/logger';
import { toLocalYmd } from '@/lib/dateLocal';

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
  const params = useLocalSearchParams<{ date: string | string[]; routeId?: string; officerId?: string }>();
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const date = useMemo(() => {
    const v = (rawDate ?? '').trim();
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const dt = new Date(v);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  }, [rawDate]);
  const routeId = params.routeId;
  const officerIdParam = typeof params.officerId === 'string' ? params.officerId : undefined;
  const { userId, role } = useAuth();
  const assigner = role === 'admin' || role === 'supervisor';

  const [name, setName] = useState('');
  const [activityTypes, setActivityTypes] = useState<string[]>([DEFAULT_ACTIVITY_TYPE]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const options = useSelector(() => appMeta$.cachedOptions.get());
  const activityTypeOptions: ActivityTypeOption[] = options?.activity_types ?? [];

  const activityTypesButtonLabel = useMemo(() => {
    if (activityTypes.length === 0) return 'Select activities';
    return activityTypes
      .map((v) => {
        const opt = activityTypeOptions.find((a) => a.value === v && a.is_active !== false);
        if (opt?.label) return opt.label;
        return ACTIVITY_TYPES.find((a) => a.value === v)?.label ?? v;
      })
      .join(', ');
  }, [activityTypes, activityTypeOptions]);

  const applyCachedRoute = useCallback((found: { name?: string; activity_types?: string[]; notes?: string }) => {
    setName(found.name ?? '');
    setActivityTypes(
      found.activity_types?.length ? found.activity_types : [DEFAULT_ACTIVITY_TYPE]
    );
    setNotes(found.notes ?? '');
  }, []);

  const loadRoute = useCallback(async () => {
    if (!routeId) {
      setName('');
      setActivityTypes([DEFAULT_ACTIVITY_TYPE]);
      setNotes('');
      setLoading(false);
      return;
    }
    setError('');
    const cachedById = () => (routesCache$.get() ?? []).find((r) => r.id === routeId);
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (!connected) {
      const cached = cachedById();
      if (cached) {
        applyCachedRoute(cached);
        setError('Offline — showing saved route.');
      } else {
        setError('Route not available offline. Open schedules online once to cache route plans.');
      }
      setLoading(false);
      return;
    }
    try {
      const found = await api.getRoute(routeId);
      applyCachedRoute(found);
      routesCache$.set((prev) => {
        const m = new Map((prev ?? []).map((r) => [r.id, r]));
        m.set(found.id, found);
        return [...m.values()];
      });
    } catch {
      const cached = cachedById();
      if (cached) {
        applyCachedRoute(cached);
        setError('Unavailable — showing last saved route.');
      } else {
        setError('Failed to load route.');
        logger.warn('Route load failed', { route_id: routeId, scheduled_date: date });
      }
    } finally {
      setLoading(false);
    }
  }, [routeId, date, applyCachedRoute]);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  const save = useCallback(async () => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Invalid date.');
      return;
    }
    if (activityTypes.length === 0) {
      setError('Select at least one activity type (tap Select activities).');
      return;
    }
    const todayStr = toLocalYmd(new Date());
    if (!routeId && date < todayStr) {
      setError('Cannot create a route for a past date.');
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
      };
      if (routeId) {
        await api.updateRoute(routeId, payload);
        logger.info('Route updated', {
          route_id: routeId,
          scheduled_date: date,
        });
        router.back();
      } else {
        const officerForCreate = assigner ? officerIdParam : userId;
        if (!officerForCreate) {
          setError(
            assigner
              ? 'Select an officer before creating a route.'
              : 'Could not determine the logged-in officer. Please sign in again.'
          );
          return;
        }
        await api.createRoute({
          ...payload,
          officer: officerForCreate,
        });
        logger.info('Route created', {
          route_id: null,
          scheduled_date: date,
          officer_id: officerForCreate,
        });
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save route.');
      logger.warn('Route save failed', {
        route_id: routeId,
        scheduled_date: date,
        error: e instanceof Error ? e.message : 'save failed',
      });
    } finally {
      setSaving(false);
    }
  }, [date, name, activityTypes, notes, routeId, router, assigner, officerIdParam, userId]);

  const deleteRoute = useCallback(async () => {
    if (!routeId) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteRoute(routeId);
      logger.info('Route deleted', { route_id: routeId, scheduled_date: date });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete.');
      logger.warn('Route delete failed', {
        route_id: routeId,
        scheduled_date: date,
        error: e instanceof Error ? e.message : 'delete failed',
      });
    } finally {
      setSaving(false);
    }
  }, [routeId, router, date]);

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

          <Text variant="bodySmall" style={styles.hint}>
            This is the day plan for the officer. When recording visits, they choose this route and can log many visits against it (different customers each time).
          </Text>

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
            Default focus for visits on this route. You can still pick activities per visit when recording.
          </Text>
          <Button
            mode="outlined"
            onPress={() => setActivityModalOpen(true)}
            style={styles.selectBtn}
            contentStyle={styles.selectBtnContent}
          >
            <Text variant="bodyMedium" style={styles.activityTypesBtnText} numberOfLines={4}>
              {activityTypesButtonLabel}
            </Text>
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
  selectBtnContent: { justifyContent: 'flex-start', paddingVertical: spacing.sm, minHeight: 48 },
  activityTypesBtnText: { textAlign: 'left', color: colors.gray900 },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  saveBtn: {},
  deleteBtn: { borderColor: colors.error },
});
