import { useAuth } from '@/contexts/AuthContext';
import { getFarmers as getFarmersDb, getFarms as getFarmsDb, getAllSchedulesForOfficer } from '@/database';
import { farmerRowToFarmer, farmRowToFarm, scheduleRowToSchedule } from '@/lib/offline-helpers';
import { enqueueSchedule } from '@/lib/syncWithServer';
import { api, getLabels, type Farm, type Farmer, type Officer, type Route, type Schedule } from '@/lib/api';
import { appMeta$ } from '@/store/observable';
import { useSelector } from '@legendapp/state/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import {
  Appbar,
  Banner,
  Button,
  Card,
  Menu,
  Snackbar,
  Text,
  TextInput,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListItemRow } from '@/components/ListItemRow';
import { SelectFarmerModal } from '@/components/SelectFarmerModal';
import { SelectFarmModal } from '@/components/SelectFarmModal';
import { appbarHeight, cardShadow, cardStyle, colors, scrollPaddingKeyboard, spacing } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';
import { logger } from '@/lib/logger';
import { localWeekMonToSat, localWeekStartYmd, toLocalYmd } from '@/lib/dateLocal';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatWeekdayHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dayIndex = (dt.getDay() + 6) % 7;
  const dayLabel = DAY_LABELS[dayIndex] ?? '';
  return `${dayLabel}, ${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

const isAssigner = (role: string | null) => role === 'admin' || role === 'supervisor';

export default function ProposeScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{ selectedFarmerId?: string; planMode?: string }>();
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
  const [partnerType, setPartnerType] = useState<'farmer' | 'stockist'>('farmer');
  const [snackbarMsg, setSnackbarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [planMode, setPlanMode] = useState<'single' | 'weekly'>(() =>
    searchParams.planMode === 'weekly' ? 'weekly' : 'single'
  );
  const [routesWeek, setRoutesWeek] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesRefreshing, setRoutesRefreshing] = useState(false);
  const [routesError, setRoutesError] = useState('');

  const labels = useSelector(() => getLabels(appMeta$.cachedOptions.get()));
  const partnerTypeLabel = partnerType === 'stockist' ? 'Stockist' : 'Farmer';
  const partnerTypeLabelLower = partnerTypeLabel.toLowerCase();
  const locationLabel = partnerType === 'stockist' ? 'Outlet' : labels.location;
  const locationLabelLower = locationLabel.toLowerCase();
  const farmersForModal = useMemo(() => {
    const isStockist = partnerType === 'stockist';
    return farmers.filter((f) => Boolean(f.is_stockist) === isStockist);
  }, [farmers, partnerType]);
  const assigner = isAssigner(role);

  const showSnackbar = useCallback((type: 'success' | 'error', text: string) => {
    setSnackbarMsg({ type, text });
    setSnackbarVisible(true);
  }, []);

  const dismissSnackbar = useCallback(() => {
    setSnackbarVisible(false);
    setSnackbarMsg(null);
  }, []);

  const weekStart = useMemo(() => localWeekStartYmd(new Date()), []);

  const weekDays = useMemo(() => localWeekMonToSat(weekStart), [weekStart]);

  const routeByDate = useMemo(() => {
    const map: Record<string, Route> = {};
    for (const r of routesWeek) {
      const prev = map[r.scheduled_date];
      if (!prev || (r.updated_at && prev.updated_at && r.updated_at > prev.updated_at)) {
        map[r.scheduled_date] = r;
      }
    }
    return map;
  }, [routesWeek]);

  const loadWeeklyRoutes = useCallback(
    async (isPullRefresh = false) => {
      if (planMode !== 'weekly') return;
      if (assigner && !selectedOfficerId) {
        setRoutesWeek([]);
        setRoutesError('');
        setRoutesLoading(false);
        setRoutesRefreshing(false);
        return;
      }
      if (isPullRefresh) setRoutesRefreshing(true);
      else setRoutesLoading(true);
      try {
        setRoutesError('');
        const list = await api.getAllRoutes({
          week_start: weekStart,
          ...(assigner && selectedOfficerId ? { officer: selectedOfficerId } : {}),
        });
        setRoutesWeek(Array.isArray(list) ? list : []);
        logger.info('Weekly routes loaded', {
          plan_mode: planMode,
          week_start: weekStart,
          officer_id: selectedOfficerId,
          routes_count: Array.isArray(list) ? list.length : 0,
        });
      } catch (e) {
        setRoutesWeek([]);
        const msg = e instanceof Error ? e.message : 'Failed to load weekly routes.';
        setRoutesError(msg);
        logger.warn('Weekly routes load failed', {
          plan_mode: planMode,
          week_start: weekStart,
          officer_id: selectedOfficerId,
          error: msg,
        });
        showSnackbar('error', msg);
      } finally {
        setRoutesLoading(false);
        setRoutesRefreshing(false);
      }
    },
    [planMode, weekStart, assigner, selectedOfficerId, showSnackbar]
  );

  useEffect(() => {
    if (searchParams.planMode === 'weekly') setPlanMode('weekly');
  }, [searchParams.planMode]);

  useEffect(() => {
    if (planMode !== 'weekly') return;
    if (!assigner) return;
    if (selectedOfficerId) return;
    if (officers.length === 0) return;
    setSelectedOfficerId(officers[0].id);
  }, [planMode, assigner, selectedOfficerId, officers]);

  useEffect(() => {
    loadWeeklyRoutes(false);
  }, [loadWeeklyRoutes]);

  const openRouteForm = useCallback(
    (date: string, routeId?: string) => {
      router.push({
        pathname: '/(app)/route-form',
        params: {
          date,
          ...(assigner && selectedOfficerId ? { officerId: selectedOfficerId } : {}),
          ...(routeId ? { routeId } : {}),
        },
      } as never);
    },
    [router, assigner, selectedOfficerId]
  );

  const quickCreateRoute = useCallback(
    async (date: string) => {
      const officerForCreate = assigner ? selectedOfficerId : userId;
      if (!officerForCreate) {
        const msg = assigner
          ? 'Select an extension officer before creating a weekly plan.'
          : 'Could not determine logged-in officer. Please sign in again.';
        setRoutesError(msg);
        showSnackbar('error', msg);
        return;
      }
      setRoutesRefreshing(true);
      try {
        await api.createRoute({
          scheduled_date: date,
          officer: officerForCreate,
          name: '',
          activity_types: [DEFAULT_ACTIVITY_TYPE],
          notes: '',
        });
        logger.info('Weekly route quick-created', {
          scheduled_date: date,
          officer_id: officerForCreate,
          plan_mode: 'weekly',
        });
        showSnackbar('success', 'Weekly plan created. You can now record visits directly.');
        await loadWeeklyRoutes(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to create weekly plan.';
        setRoutesError(msg);
        logger.warn('Weekly route quick-create failed', {
          scheduled_date: date,
          officer_id: officerForCreate,
          error: msg,
        });
        showSnackbar('error', msg);
      } finally {
        setRoutesRefreshing(false);
      }
    },
    [assigner, selectedOfficerId, userId, showSnackbar, loadWeeklyRoutes]
  );

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? false));
    return () => sub();
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
    const today = toLocalYmd(new Date());
    if (!selectedDate) setSelectedDate(today);
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      const id = searchParams.selectedFarmerId;
      load().then(() => {
        if (id) setSelectedFarmerId(id);
      });
      void loadWeeklyRoutes(false);
    }, [searchParams.selectedFarmerId, load, loadWeeklyRoutes])
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
        if (connected) {
          try {
            const list = await api.getFarms(selectedFarmerId);
            if (!cancelled) setFarms(list);
          } catch {
            const local = (await getFarmsDb(selectedFarmerId)).map(farmRowToFarm);
            if (!cancelled) setFarms(local);
          }
        } else {
          const local = (await getFarmsDb(selectedFarmerId)).map(farmRowToFarm);
          if (!cancelled) setFarms(local);
        }
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
      logger.info('Schedule created', {
        mode: planMode,
        officer_id: assigner ? selectedOfficerId : userId,
        scheduled_date: dateStr,
        farmer_id: selectedFarmerId,
        farm_id: selectedFarmId,
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
          logger.info('Schedule queued offline', {
            mode: planMode,
            officer_id: assigner ? selectedOfficerId : userId,
            scheduled_date: dateStr,
            farmer_id: selectedFarmerId,
            farm_id: selectedFarmId,
          });
          showSnackbar('success', 'Saved for sync when back online.');
          setTimeout(() => router.back(), 1500);
        } catch (enqErr) {
          setError(enqErr instanceof Error ? enqErr.message : 'Failed to save for sync');
          logger.warn('Schedule offline queue failed', {
            mode: planMode,
            scheduled_date: dateStr,
            error: enqErr instanceof Error ? enqErr.message : 'enqueue failed',
          });
          showSnackbar('error', enqErr instanceof Error ? enqErr.message : 'Failed to save for sync');
        }
      } else {
        const message = e instanceof Error ? e.message : 'Failed to propose schedule';
        setError(message);
        logger.warn('Schedule create failed', {
          mode: planMode,
          officer_id: assigner ? selectedOfficerId : userId,
          scheduled_date: dateStr,
          error: message,
        });
        showSnackbar('error', message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [assigner, userId, selectedDate, selectedOfficerId, selectedFarmerId, selectedFarmId, notes, router, showSnackbar, isOnline]);

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  const appBarTitle =
    planMode === 'weekly' ? 'Weekly routes (Mon–Sat)' : 'Propose schedule';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title={appBarTitle} />
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
        <Appbar.Content title={appBarTitle} />
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
          refreshControl={
            planMode === 'weekly' && (!assigner || selectedOfficerId) ? (
              <RefreshControl
                refreshing={routesRefreshing}
                onRefresh={() => void loadWeeklyRoutes(true)}
              />
            ) : undefined
          }
        >
          <Text variant="bodyMedium" style={styles.hint}>
            {planMode === 'weekly'
              ? assigner
                ? 'Pick an officer, then plan their Mon–Sat routes. Use Single visit to assign one dated schedule.'
                : 'Plan Mon–Sat routes (customers per day). Use Single visit to propose one schedule for a specific date.'
              : assigner
                ? 'Assign a visit to an extension officer. The schedule is accepted immediately.'
                : 'Your supervisor will accept or reject the proposal. The schedule is for you (logged-in user).'}
          </Text>

          <Text variant="labelLarge" style={styles.label}>Plan type</Text>
          <View style={styles.partnerTypeRow}>
            <Button
              mode={planMode === 'single' ? 'contained' : 'outlined'}
              compact
              onPress={() => setPlanMode('single')}
              style={styles.partnerTypeBtn}
            >
              Single visit
            </Button>
            <Button
              mode={planMode === 'weekly' ? 'contained' : 'outlined'}
              compact
              onPress={() => setPlanMode('weekly')}
              style={styles.partnerTypeBtn}
            >
              Weekly routes
            </Button>
          </View>

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

          {planMode === 'single' ? (
          <>
          <Text variant="labelLarge" style={styles.label}>Who is being visited? *</Text>
          <Text variant="bodySmall" style={styles.partnerTypeHint}>
            Choose whether this visit is to a farmer or a stockist.
          </Text>
          <View style={styles.partnerTypeRow}>
            <Button
              mode={partnerType === 'farmer' ? 'contained' : 'outlined'}
              compact
              onPress={() => {
                setPartnerType('farmer');
                if (selectedFarmerId && farmers.find((f) => f.id === selectedFarmerId)?.is_stockist) {
                  setSelectedFarmerId(null);
                  setSelectedFarmId(null);
                }
              }}
              style={styles.partnerTypeBtn}
            >
              Farmer
            </Button>
            <Button
              mode={partnerType === 'stockist' ? 'contained' : 'outlined'}
              compact
              onPress={() => {
                setPartnerType('stockist');
                if (selectedFarmerId && !farmers.find((f) => f.id === selectedFarmerId)?.is_stockist) {
                  setSelectedFarmerId(null);
                  setSelectedFarmId(null);
                }
              }}
              style={styles.partnerTypeBtn}
            >
              Stockist
            </Button>
          </View>

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

          <Text variant="labelLarge" style={styles.label}>{partnerTypeLabel} (optional)</Text>
          <Button
            mode="outlined"
            onPress={() => setFarmerModalOpen(true)}
            style={styles.farmerSelectBtn}
            contentStyle={styles.farmerSelectBtnContent}
            icon="account-search"
          >
            {selectedFarmerId
              ? (farmers.find((f) => f.id === selectedFarmerId)?.display_name ?? `${partnerTypeLabel} selected`)
              : `Select ${partnerTypeLabelLower}`}
          </Button>
          <Button
            mode="text"
            compact
            icon="account-plus"
            onPress={() => router.push({ pathname: '/(app)/add-farmer', params: { returnTo: 'propose-schedule', asStockist: partnerType === 'stockist' ? '1' : undefined } })}
            style={styles.addFarmerLink}
          >
            Add new {partnerTypeLabelLower}
          </Button>
          <SelectFarmerModal
            visible={farmerModalOpen}
            onClose={() => setFarmerModalOpen(false)}
            farmers={farmersForModal}
            selectedFarmerId={selectedFarmerId}
            onSelect={setSelectedFarmerId}
            title={`Select ${partnerTypeLabelLower}`}
            noPartnerLabel={partnerType === 'stockist' ? 'No stockist' : 'No farmer'}
          />

          {selectedFarmerId && (
            <>
              <Text variant="labelLarge" style={styles.label}>{locationLabel} (optional)</Text>
              {farms.length === 0 ? (
                <Text variant="bodySmall" style={styles.muted}>No {locationLabelLower}s for this {partnerTypeLabelLower}</Text>
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
                      ? selectedFarm.village
                      : `Select ${locationLabelLower}`}
                  </Button>
                  <SelectFarmModal
                    visible={farmModalOpen}
                    onClose={() => setFarmModalOpen(false)}
                    farms={farms}
                    selectedFarmId={selectedFarmId}
                    onSelect={setSelectedFarmId}
                    title={`Select ${locationLabelLower}`}
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
          </>
          ) : (
            <>
              {assigner && !selectedOfficerId ? (
                <Text variant="bodySmall" style={styles.muted}>
                  Select an extension officer above to load and edit weekly routes.
                </Text>
              ) : (
                <>
                  <Text variant="bodyMedium" style={styles.weekHint}>
                    Tap a day to add or edit that day&apos;s route (customers to visit that day).
                  </Text>
                  {routesError ? (
                    <View style={styles.weekErrorBox}>
                      <Text variant="bodySmall" style={styles.weekErrorText}>{routesError}</Text>
                      <Button mode="outlined" compact onPress={() => void loadWeeklyRoutes(false)}>
                        Retry
                      </Button>
                    </View>
                  ) : routesLoading ? (
                    <ActivityIndicator size="large" style={styles.weekLoader} />
                  ) : (
                    weekDays.map((date) => {
                      const route = routeByDate[date];
                      const hasRoute = !!route;
                      const actCount = route?.activity_types?.length ?? 0;
                      return (
                        <Card
                          key={date}
                          style={styles.weekCard}
                          elevation={0}
                          onPress={() => openRouteForm(date, route?.id)}
                        >
                          <Card.Content style={styles.weekCardContent}>
                            <View style={styles.weekRow}>
                              <View style={styles.weekDateBlock}>
                                <Text variant="labelLarge" style={styles.weekDateHeader}>
                                  {formatWeekdayHeader(date)}
                                </Text>
                                {hasRoute ? (
                                  <Text variant="bodyMedium" style={styles.weekRouteSummary}>
                                    {route.name || 'Day route'}
                                    {actCount > 0
                                      ? ` · ${actCount} ${actCount === 1 ? 'activity' : 'activities'}`
                                      : ''}
                                  </Text>
                                ) : (
                                  <Text variant="bodySmall" style={styles.weekNoRoute}>
                                    No route yet
                                  </Text>
                                )}
                              </View>
                              {hasRoute ? (
                                <MaterialCommunityIcons
                                  name="pencil"
                                  size={24}
                                  color={colors.primary}
                                />
                              ) : (
                                <Button
                                  mode="contained-tonal"
                                  compact
                                  onPress={() => quickCreateRoute(date)}
                                >
                                  Create plan
                                </Button>
                              )}
                            </View>
                          </Card.Content>
                        </Card>
                      );
                    })
                  )}
                </>
              )}
            </>
          )}

          <Text variant="titleMedium" style={styles.sectionTitle}>
            My recent schedules
          </Text>
          {schedules.length === 0 ? (
            <Text variant="bodySmall" style={styles.muted}>No schedules yet</Text>
          ) : (
            schedules.slice(0, 10).map((s) => {
              const displayName = s.farmer_display_name ?? farmers.find((f) => f.id === s.farmer)?.display_name ?? `No ${labels.partner.toLowerCase()} assigned`;
              return (
                <ListItemRow
                  key={s.id}
                  avatarLetter={(displayName || '?').charAt(0)}
                  title={displayName}
                  subtitle={`${formatDate(s.scheduled_date)} · ${labels.location}: ${s.farm_display_name ?? 'None'} · ${s.status}`}
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
  partnerTypeHint: { marginBottom: 8, color: colors.gray700 },
  partnerTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  partnerTypeBtn: { flex: 1 },
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
  weekHint: { marginBottom: spacing.md, color: colors.gray700 },
  weekLoader: { marginVertical: spacing.xl },
  weekCard: { ...cardStyle, ...cardShadow, marginBottom: spacing.md },
  weekCardContent: { paddingVertical: spacing.sm },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekDateBlock: { flex: 1 },
  weekDateHeader: { color: colors.gray900, fontWeight: '700' },
  weekRouteSummary: { color: colors.gray700, marginTop: 2 },
  weekNoRoute: { color: colors.gray500, marginTop: 2 },
  weekErrorBox: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    backgroundColor: colors.errorLight,
    gap: spacing.sm,
  },
  weekErrorText: { color: colors.error },
});
