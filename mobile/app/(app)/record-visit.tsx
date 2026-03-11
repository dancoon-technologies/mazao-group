import {
  getFarmers as getFarmersDb,
  getFarms as getFarmsDb,
  getPlannedSchedules as getPlannedSchedulesDb,
  getScheduleIdsWithRecordedVisits,
} from '@/database';
import { useAuth } from '@/contexts/AuthContext';
import { api, type ActivityFormFieldOption, type ActivityTypeOption, type Farm, type Farmer, type Schedule, type VisitSettings } from '@/lib/api';
import { ACTIVITY_TYPES, DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';
import { enqueueVisit, syncWithServer } from '@/lib/syncWithServer';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  HelperText,
  List,
  Menu,
  Portal,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListItemRow } from '@/components/ListItemRow';
import {
  colors,
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_WARNING_DISTANCE_METERS,
  formHeaderHeight,
  radius,
  scrollPaddingKeyboard,
  spacing,
} from '@/constants/theme';

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Device + OS string for photo metadata (e.g. "iPhone 14, iOS 17" or "Pixel 6, Android 14"). */
function getPhotoDeviceInfo(): string {
  const deviceName = Constants.deviceName ?? Platform.OS;
  const osVersion = Platform.Version != null ? String(Platform.Version) : '';
  const part = Platform.OS === 'ios' ? `iOS ${osVersion}` : `Android ${osVersion}`;
  return [deviceName, part].filter(Boolean).join(', ') || 'Mobile device';
}

export default function RecordVisitScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { userId } = useAuth();
  const params = useLocalSearchParams<{ farmerId?: string; scheduleId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoTakenAt, setPhotoTakenAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [plannedSchedules, setPlannedSchedules] = useState<Schedule[]>([]);
  const [scheduleIdsWithRecordedVisits, setScheduleIdsWithRecordedVisits] = useState<Set<string>>(new Set());
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(params.scheduleId ?? null);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(params.farmerId ?? null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [activityType, setActivityType] = useState(DEFAULT_ACTIVITY_TYPE);
  const [activityTypesList, setActivityTypesList] = useState<ActivityTypeOption[]>([]);
  const [farmerMenuOpen, setFarmerMenuOpen] = useState(false);
  const [farmMenuOpen, setFarmMenuOpen] = useState(false);
  const [activityMenuOpen, setActivityMenuOpen] = useState(false);
  const [accordionExpanded, setAccordionExpanded] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [cropStage, setCropStage] = useState('');
  const [germinationPercent, setGerminationPercent] = useState('');
  const [survivalRatePercent, setSurvivalRatePercent] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [harvestKgs, setHarvestKgs] = useState('');
  const [pestsDiseases, setPestsDiseases] = useState('');
  const [farmersFeedback, setFarmersFeedback] = useState('');
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogSuccess, setDialogSuccess] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [visitSettings, setVisitSettings] = useState<VisitSettings | null>(null);
  const [step, setStep] = useState(0); // 0 = schedule, 1 = details & photo, 2 = additional fields

  const selectedFarmer = farmers.find((f) => f.id === selectedFarmerId);
  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  const refPoint = selectedFarm ?? (selectedFarmer && selectedFarmer.latitude != null && selectedFarmer.longitude != null
    ? { latitude: Number(selectedFarmer.latitude), longitude: Number(selectedFarmer.longitude) }
    : null);

  const distanceM = useMemo(() => {
    if (!location || !refPoint) return null;
    return Math.round(
      haversineDistance(
        location.coords.latitude,
        location.coords.longitude,
        refPoint.latitude,
        refPoint.longitude
      )
    );
  }, [location, refPoint]);

  const maxM = visitSettings?.max_distance_meters ?? 100;
  const warningM = visitSettings?.warning_distance_meters ?? 80;
  const gpsValid = distanceM === null || distanceM <= maxM;
  const distanceWarning = distanceM !== null && distanceM > warningM && distanceM <= maxM;
  const progress = distanceM !== null ? Math.max(0, 1 - distanceM / maxM) : 1;

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? false));
    return () => sub();
  }, []);

  useEffect(() => {
    api
      .getOptions()
      .then((o) => {
        setVisitSettings(o.visit_settings);
        if (o.activity_types?.length) {
          setActivityTypesList(o.activity_types);
          setActivityType((prev) => {
            const allowed = o.activity_types!.map((a) => a.value);
            return allowed.includes(prev) ? prev : (o.activity_types![0]?.value ?? prev);
          });
        } else {
          setActivityTypesList(ACTIVITY_TYPES.map((a) => ({ value: a.value, label: a.label })));
        }
      })
      .catch(() => {
        setVisitSettings(null);
        setActivityTypesList(ACTIVITY_TYPES.map((a) => ({ value: a.value, label: a.label })));
      });
  }, []);

  const activityTypeOptions = useMemo(
    () =>
      activityTypesList.length
        ? activityTypesList
        : ACTIVITY_TYPES.map((a) => ({ value: a.value, label: a.label })),
    [activityTypesList]
  );

  /** Default form fields for step 3 when activity has no form_fields config (show all). */
  const DEFAULT_STEP3_FIELDS: ActivityFormFieldOption[] = [
    { key: 'crop_stage', label: 'Crop Stage', required: false },
    { key: 'germination_percent', label: 'Germination %', required: false },
    { key: 'survival_rate', label: 'Survival Rate %', required: false },
    { key: 'pests_diseases', label: 'Pests/Diseases', required: false },
    { key: 'order_value', label: 'Order Value', required: false },
    { key: 'harvest_kgs', label: 'Harvest (kg)', required: false },
    { key: 'farmers_feedback', label: "Farmer's Feedback", required: false },
  ];

  const step3Fields = useMemo(() => {
    const config = activityTypesList.find((a) => a.value === activityType);
    const fields = config?.form_fields?.length ? config.form_fields : DEFAULT_STEP3_FIELDS;
    return fields;
  }, [activityType, activityTypesList]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getFarmersDb();
        if (cancelled) return;
        const list: Farmer[] = rows.map((r) => ({
          id: r.id,
          first_name: r.first_name,
          middle_name: r.middle_name ?? undefined,
          last_name: r.last_name,
          display_name: r.display_name ?? [r.first_name, r.last_name].filter(Boolean).join(' '),
          phone: r.phone ?? undefined,
          latitude: r.latitude ?? undefined,
          longitude: r.longitude ?? undefined,
          crop_type: r.crop_type ?? undefined,
          assigned_officer: r.assigned_officer ?? undefined,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
        }));
        setFarmers(list);
      } catch {
        if (!cancelled) setFarmers([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isOnline === true) {
      syncWithServer().catch(() => {});
    }
  }, [isOnline]);

  useEffect(() => {
    if (params.farmerId) setSelectedFarmerId(params.farmerId);
  }, [params.farmerId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const farmerId = params.farmerId;
      (async () => {
        try {
          const rows = await getFarmersDb();
          if (cancelled) return;
          const list: Farmer[] = rows.map((r) => ({
            id: r.id,
            first_name: r.first_name,
            middle_name: r.middle_name ?? undefined,
            last_name: r.last_name,
            display_name: r.display_name ?? [r.first_name, r.last_name].filter(Boolean).join(' '),
            phone: r.phone ?? undefined,
            latitude: r.latitude ?? undefined,
            longitude: r.longitude ?? undefined,
            crop_type: r.crop_type ?? undefined,
            assigned_officer: r.assigned_officer ?? undefined,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
          }));
          setFarmers(list);
          if (farmerId) setSelectedFarmerId(farmerId);
        } catch {
          if (!cancelled && farmerId) setSelectedFarmerId(farmerId);
        }
        if (!userId) return;
        try {
          const todayStr = new Date().toISOString().slice(0, 10);
          const startTs = new Date(`${todayStr}T00:00:00.000Z`).getTime();
            const endTs = startTs + 7 * 24 * 60 * 60 * 1000;
          const scheduleRows = await getPlannedSchedulesDb(userId, startTs, endTs);
          if (cancelled) return;
          const scheduleList: Schedule[] = scheduleRows.map((r) => ({
            id: r.id,
            officer: r.officer,
            officer_email: '',
            farmer: r.farmer ?? null,
            farmer_display_name: null,
            farm: r.farm ?? null,
            farm_display_name: r.farm_display_name ?? null,
            scheduled_date: new Date(r.scheduled_date).toISOString().slice(0, 10),
            notes: r.notes ?? '',
            status: r.status as 'proposed' | 'accepted' | 'rejected',
            created_at: undefined,
          }));
          setPlannedSchedules(scheduleList);
          const recordedSet = await getScheduleIdsWithRecordedVisits(userId);
          if (!cancelled) setScheduleIdsWithRecordedVisits(recordedSet);
        } catch {
          if (!cancelled) setPlannedSchedules([]);
        }
      })();
      return () => { cancelled = true; };
    }, [params.farmerId, userId])
  );

  const acceptedSchedules = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return plannedSchedules.filter(
      (s) =>
        s.status === 'accepted' &&
        !scheduleIdsWithRecordedVisits.has(s.id) &&
        s.scheduled_date <= today
    );
  }, [plannedSchedules, scheduleIdsWithRecordedVisits]);

  // Only clear selection when we have loaded schedules and the selected one is not in the accepted list.
  // Do not clear when plannedSchedules is empty (e.g. after a failed load), so user selection is not wiped.
  useEffect(() => {
    if (plannedSchedules.length === 0) return;
    if (selectedScheduleId && !acceptedSchedules.some((s) => s.id === selectedScheduleId)) {
      setSelectedScheduleId(null);
    }
  }, [selectedScheduleId, acceptedSchedules, plannedSchedules.length]);

  useEffect(() => {
    const scheduleId = typeof params.scheduleId === 'string' ? params.scheduleId : Array.isArray(params.scheduleId) ? params.scheduleId[0] : undefined;
    if (scheduleId && plannedSchedules.length > 0) {
      const s = plannedSchedules.find((sch) => sch.id === scheduleId);
      if (s?.status === 'accepted') {
        setSelectedScheduleId(s.id);
        setSelectedFarmerId(s.farmer ?? null);
        setSelectedFarmId(s.farm ?? null);
      }
    }
  }, [params.scheduleId, plannedSchedules]);

  const selectedSchedule = plannedSchedules.find((s) => s.id === selectedScheduleId);
  const scheduleLockedForFarm = !!selectedScheduleId && selectedSchedule?.status === 'accepted' && selectedSchedule?.farm;

  useEffect(() => {
    if (!selectedFarmerId) {
      setFarms([]);
      setSelectedFarmId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await getFarmsDb(selectedFarmerId);
        if (cancelled) return;
        const list: Farm[] = rows.map((r) => ({
          id: r.id,
          farmer: r.farmer_id,
          village: r.village,
          latitude: r.latitude,
          longitude: r.longitude,
          plot_size: r.plot_size ?? undefined,
          crop_type: r.crop_type ?? undefined,
          region_id: r.region_id ?? undefined,
          region: r.region ?? undefined,
          county_id: r.county_id ?? undefined,
          county: r.county ?? undefined,
          sub_county_id: r.sub_county_id ?? undefined,
          sub_county: r.sub_county ?? undefined,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
        }));
        setFarms(list);
        setSelectedFarmId((prev) => {
          if (prev && list.some((f) => f.id === prev)) return prev;
          if (scheduleLockedForFarm && selectedSchedule?.farm) return selectedSchedule.farm;
          return null;
        });
      } catch {
        if (!cancelled) setFarms([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedFarmerId, scheduleLockedForFarm, selectedSchedule?.farm]);

  useEffect(() => {
    let cancelled = false;
    setLocationLoading(true);
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setLocationError('Location permission is required.');
        setLocationLoading(false);
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!cancelled) setLocation(loc);
      } catch {
        if (!cancelled) setLocationError('Could not get location.');
      }
      if (!cancelled) setLocationLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !permission?.granted) return;
    try {
      const takenAt = new Date().toISOString();
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true,
        ...(location?.coords && {
          additionalExif: {
            GPSLatitude: location.coords.latitude,
            GPSLongitude: location.coords.longitude,
            GPSAltitude: location.coords.altitude ?? 0,
            DateTimeOriginal: takenAt.replace(/\.\d{3}Z$/, ''),
          },
        }),
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setPhotoTakenAt(takenAt);
        setCameraModalVisible(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to take photo');
    }
  }, [permission?.granted, location?.coords]);

  const openCameraModal = useCallback(() => {
    if (!permission?.granted) {
      requestPermission();
      return;
    }
    setCameraModalVisible(true);
  }, [permission?.granted, requestPermission]);

  const refreshLocation = useCallback(async () => {
    setLocationError('');
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
    } catch {
      setLocationError('Could not get location.');
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const mustSelectSchedule = !selectedScheduleId || selectedSchedule?.status !== 'accepted';
  const scheduleLocked = !!selectedScheduleId && selectedSchedule?.status === 'accepted';
  const scheduleIdForSubmit = scheduleLocked ? selectedScheduleId : undefined;

  const submit = useCallback(async () => {
    if (mustSelectSchedule) {
      setError(
        acceptedSchedules.length === 0
          ? 'You need an accepted schedule for today or a past date to record a visit. Future dates are not allowed.'
          : 'Select a planned visit (accepted schedule) with date today or in the past.'
      );
      return;
    }
    if (!selectedFarmerId || !photoUri || !location) {
      setError('Select farmer, capture photo, and ensure location is available.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // Re-check connectivity at submit time — NetInfo listener can be stale, so user may be online even if UI said offline
      const netState = await NetInfo.fetch();
      const connected = netState.isConnected === true;

      if (connected) {
        const photoPlaceName = selectedFarm?.village ?? selectedFarmer?.display_name ?? 'Visit location';
        try {
          await api.createVisit({
          farmer_id: selectedFarmerId,
          farm_id: selectedFarmId || undefined,
          schedule_id: scheduleIdForSubmit ?? undefined,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          photo: { uri: photoUri, type: 'image/jpeg', name: 'visit.jpg' },
          photo_taken_at: photoTakenAt ?? new Date().toISOString(),
          photo_device_info: getPhotoDeviceInfo(),
          photo_place_name: photoPlaceName,
          activity_type: activityType,
          notes: notes || undefined,
          crop_stage: cropStage || undefined,
          germination_percent: germinationPercent ? parseFloat(germinationPercent) : undefined,
          survival_rate: survivalRatePercent || undefined,
          pests_diseases: pestsDiseases || undefined,
          order_value: orderValue ? parseFloat(orderValue) : undefined,
          harvest_kgs: harvestKgs ? parseFloat(harvestKgs) : undefined,
          farmers_feedback: farmersFeedback || undefined,
        });
          if (scheduleIdForSubmit) {
            setScheduleIdsWithRecordedVisits((prev) => new Set(prev).add(scheduleIdForSubmit));
          }
          setDialogSuccess(true);
          setDialogVisible(true);
          return;
        } catch {
          setSnackbarMsg('Offline or server error — saving for sync.');
        }
      }
      if (!scheduleIdForSubmit) {
        setError('A planned schedule is required to record a visit.');
        return;
      }
      const photoPlaceName = selectedFarm?.village ?? selectedFarmer?.display_name ?? 'Visit location';
      await enqueueVisit({
        farmer_id: selectedFarmerId,
        farm_id: selectedFarmId || undefined,
        schedule_id: scheduleIdForSubmit,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        photo_uri: photoUri,
        photo_taken_at: photoTakenAt ?? new Date().toISOString(),
        photo_device_info: getPhotoDeviceInfo(),
        photo_place_name: photoPlaceName,
        notes: notes || undefined,
        activity_type: activityType,
        crop_stage: cropStage || undefined,
        germination_percent: germinationPercent ? parseFloat(germinationPercent) : undefined,
        survival_rate: survivalRatePercent || undefined,
        pests_diseases: pestsDiseases || undefined,
        order_value: orderValue ? parseFloat(orderValue) : undefined,
        harvest_kgs: harvestKgs ? parseFloat(harvestKgs) : undefined,
        farmers_feedback: farmersFeedback || undefined,
      });
      if (scheduleIdForSubmit) {
        setScheduleIdsWithRecordedVisits((prev) => new Set(prev).add(scheduleIdForSubmit));
      }
      setSnackbarMsg('Saved for sync when online.');
      // Try sync once so if we're actually online (stale NetInfo), the visit uploads immediately
      syncWithServer().catch(() => {});
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit visit.');
      setDialogSuccess(false);
      setDialogVisible(true);
    } finally {
      setSubmitting(false);
    }
  }, [mustSelectSchedule, acceptedSchedules.length, selectedFarmerId, selectedFarmId, selectedScheduleId, scheduleIdForSubmit, photoUri, photoTakenAt, location, selectedFarm, selectedFarmer, activityType, notes, cropStage, germinationPercent, survivalRatePercent, orderValue, harvestKgs, pestsDiseases, farmersFeedback, router]);

  const activityLabel =
    activityTypesList.find((a) => a.value === activityType)?.label ??
    ACTIVITY_TYPES.find((a) => a.value === activityType)?.label ??
    activityType;

  if (!permission) {
    return (
      <Surface style={styles.centered} elevation={0}>
        <ActivityIndicator size="large" />
      </Surface>
    );
  }

  if (!permission.granted) {
    return (
      <Surface style={styles.centered} elevation={0}>
        <Text variant="bodyLarge">Camera access is required to record visit proof.</Text>
        <Button mode="contained" onPress={requestPermission} style={styles.topBtn}>
          Allow camera
        </Button>
      </Surface>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Record Visit
        </Text>
        <Pressable onPress={() => router.back()} style={styles.headerClose} hitSlop={12}>
          <Text variant="headlineMedium" style={styles.headerCloseText}>×</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={formHeaderHeight}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingKeyboard, flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={true}
        >
          {!isOnline && isOnline !== null && (
            <Chip icon="cloud-off-outline" style={styles.offlineChip} compact>
              Offline — will sync when back online
            </Chip>
          )}

          {/* Stepper */}
          <View style={styles.stepperRow}>
            <Pressable onPress={() => setStep(0)} style={[styles.stepperStep, step === 0 && styles.stepperStepActive]}>
              <Text variant="labelSmall" style={step === 0 ? styles.stepperStepTextActive : styles.stepperStepText}>1. Schedule</Text>
            </Pressable>
            <Pressable onPress={() => step >= 1 && setStep(1)} style={[styles.stepperStep, step === 1 && styles.stepperStepActive]} disabled={step < 1}>
              <Text variant="labelSmall" style={step === 1 ? styles.stepperStepTextActive : styles.stepperStepText}>2. Details</Text>
            </Pressable>
            <Pressable onPress={() => step >= 2 && setStep(2)} style={[styles.stepperStep, step === 2 && styles.stepperStepActive]} disabled={step < 2}>
              <Text variant="labelSmall" style={step === 2 ? styles.stepperStepTextActive : styles.stepperStepText}>3. Additional</Text>
            </Pressable>
          </View>

          {/* Step 1: Select schedule */}
          {step === 0 && (
            <>
              {acceptedSchedules.length > 0 ? (
                <Surface style={styles.section} elevation={0}>
                  <Text variant="labelLarge" style={styles.fieldLabel}>Planned visit (accepted) *</Text>
                  <Text variant="bodySmall" style={styles.hint}>
                    Select the accepted schedule for this visit. Farmer and farm are set from the schedule.
                  </Text>
                  <View style={styles.scheduleChips}>
                    {acceptedSchedules.map((s) => {
                      const farmerName = farmers.find((f) => f.id === s.farmer)?.display_name ?? s.farmer ?? '—';
                      const dateStr = s.scheduled_date;
                      return (
                        <Chip
                          key={s.id}
                          selected={selectedScheduleId === s.id}
                          onPress={() => {
                            setSelectedScheduleId(s.id);
                            if (s.farmer) setSelectedFarmerId(s.farmer);
                            setSelectedFarmId(s.farm ?? null);
                          }}
                          style={styles.scheduleChip}
                          compact
                        >
                          {dateStr} — {farmerName} · Farm: {s.farm_display_name ?? 'None'}
                        </Chip>
                      );
                    })}
                  </View>
                  {mustSelectSchedule && (
                    <HelperText type="error" style={styles.errorHint}>Select a planned visit to continue.</HelperText>
                  )}
                </Surface>
              ) : (
                <Surface style={styles.section} elevation={0}>
                  <Text variant="labelLarge" style={styles.fieldLabel}>Planned visit (required)</Text>
                  <Text variant="bodySmall" style={styles.hint}>
                    No accepted schedules for today or earlier. Visits can only be recorded for a planned schedule whose date is today or in the past.
                  </Text>
                </Surface>
              )}
              <View style={styles.stepActions}>
                <Button mode="contained" onPress={() => setStep(1)} disabled={mustSelectSchedule} style={styles.nextBtn}>
                  Next: Details & photo
                </Button>
              </View>
            </>
          )}

          {/* Step 2: Farmer/farm details, activity, photo, location */}
          {step === 1 && (
            <>
              <Surface style={styles.section} elevation={0}>
                <Text variant="labelLarge" style={styles.fieldLabel}>Farmer & farm (from schedule)</Text>
                <Text variant="bodySmall" style={styles.hint}>
                  Set by the planned visit you selected. Change schedule in step 1 to change farmer or farm.
                </Text>
                {selectedFarmer && (
                  <ListItemRow
                    avatarLetter={(selectedFarmer.display_name || '?').charAt(0)}
                    title={selectedFarmer.display_name ?? '—'}
                    subtitle={selectedFarmer.phone ? `Tel: ${selectedFarmer.phone}` : undefined}
                  />
                )}
                {scheduleLockedForFarm && selectedFarm ? (
                  <ListItemRow
                    avatarLetter={selectedFarm.village.charAt(0)}
                    title={selectedFarm.village}
                    subtitle={`${selectedFarm.crop_type ?? '—'} · ${selectedFarm.plot_size ?? '—'}`}
                  />
                ) : selectedFarmer && !scheduleLockedForFarm ? (
                  <View style={styles.farmSelectWrap}>
                    <Text variant="labelSmall" style={styles.fieldLabel}>Farm (optional)</Text>
                    <Menu
                      visible={farmMenuOpen}
                      onDismiss={() => setFarmMenuOpen(false)}
                      anchor={
                        <TextInput
                          placeholder={farms.length ? 'Select farm' : 'No farms for this farmer'}
                          value={selectedFarm ? `${selectedFarm.village}${selectedFarm.crop_type ? ` · ${selectedFarm.crop_type}` : ''}` : ''}
                          mode="outlined"
                          right={<TextInput.Icon icon="menu-down" onPress={() => farms.length > 0 && setFarmMenuOpen(true)} />}
                          style={styles.input}
                          onPressIn={() => farms.length > 0 && setFarmMenuOpen(true)}
                          editable={false}
                        />
                      }
                    >
                      <Menu.Item onPress={() => { setSelectedFarmId(null); setFarmMenuOpen(false); }} title="None" />
                      {farms.map((f) => (
                        <Menu.Item
                          key={f.id}
                          onPress={() => { setSelectedFarmId(f.id); setFarmMenuOpen(false); }}
                          title={`${f.village}${f.crop_type ? ` · ${f.crop_type}` : ''}`}
                        />
                      ))}
                    </Menu>
                  </View>
                ) : selectedFarmer && (
                  <Text variant="bodySmall" style={styles.hint}>No specific farm for this visit</Text>
                )}
              </Surface>

              <Surface style={styles.section} elevation={0}>
                <Text variant="labelLarge" style={styles.fieldLabel}>Activity Type *</Text>
                <Menu
                  visible={activityMenuOpen}
                  onDismiss={() => setActivityMenuOpen(false)}
                  anchor={
                    <TextInput
                      placeholder="Select activity type"
                      value={activityLabel}
                      mode="outlined"
                      right={<TextInput.Icon icon="menu-down" onPress={() => setActivityMenuOpen(true)} />}
                      style={styles.input}
                      onPressIn={() => setActivityMenuOpen(true)}
                      editable={false}
                    />
                  }
                >
                  {activityTypeOptions.map((a) => (
                    <Menu.Item
                      key={a.value}
                      onPress={() => {
                        setActivityType(a.value);
                        setActivityMenuOpen(false);
                      }}
                      title={a.label}
                    />
                  ))}
                </Menu>
              </Surface>

              <Surface style={styles.section} elevation={0}>
                <View style={styles.locationBox}>
                  <View style={styles.locationBoxLeft}>
                    <List.Icon icon="map-marker" color={theme.colors.primary} style={styles.locationIcon} />
                    <View>
                      <Text variant="labelLarge" style={styles.fieldLabel}>Location</Text>
                      {locationError ? (
                        <Text variant="bodySmall" style={styles.locationStatusError}>{locationError}</Text>
                      ) : locationLoading ? (
                        <Text variant="bodySmall" style={styles.locationStatus}>Getting location…</Text>
                      ) : location ? (
                        <Text variant="bodySmall" style={styles.locationStatus}>
                          {distanceM !== null ? `Distance: ${distanceM}m (max ${maxM}m)` : 'Location captured'}
                        </Text>
                      ) : (
                        <Text variant="bodySmall" style={styles.locationStatus}>Location not captured</Text>
                      )}
                      {location && distanceM !== null && distanceWarning && gpsValid && (
                        <HelperText type="info">You are approaching the limit. Stay within {maxM}m to submit.</HelperText>
                      )}
                      {location && distanceM !== null && !gpsValid && (
                        <HelperText type="error">Must be within {maxM}m of the farmer/farm to record this visit.</HelperText>
                      )}
                    </View>
                  </View>
                  <Button mode="outlined" compact onPress={refreshLocation} disabled={locationLoading}>
                    Refresh
                  </Button>
                </View>
              </Surface>

              <Surface style={styles.section} elevation={0}>
                <Text variant="labelLarge" style={styles.fieldLabel}>Photo Evidence *</Text>
                <View style={styles.photoEvidenceRow}>
                  <Button mode="outlined" icon="camera" onPress={openCameraModal} style={styles.photoEvidenceBtn}>
                    Take Photo
                  </Button>
                </View>
                {photoUri ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: photoUri }} style={styles.previewImg} contentFit="cover" />
                    <Button mode="text" compact onPress={() => { setPhotoUri(null); openCameraModal(); }}>
                      Retake photo
                    </Button>
                  </View>
                ) : null}
              </Surface>

              <View style={styles.stepActions}>
                <Button mode="outlined" onPress={() => setStep(0)} style={styles.nextBtn}>
                  Back
                </Button>
                <Button
                  mode="contained"
                  onPress={() => setStep(2)}
                  disabled={
                    !photoUri ||
                    !location ||
                    (location && distanceM !== null && !gpsValid)
                  }
                  style={styles.nextBtn}
                >
                  Next: Additional info
                </Button>
              </View>
            </>
          )}

          {/* Step 3: Additional fields (activity-based) and submit */}
          {step === 2 && (
            <>
              <Surface style={styles.section} elevation={0}>
                <Text variant="labelLarge" style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  placeholder="Add any notes about this visit..."
                  style={styles.input}
                />
              </Surface>

              <Surface style={styles.section} elevation={0}>
                <Text variant="labelLarge" style={styles.fieldLabel}>Additional details</Text>
                <Text variant="bodySmall" style={styles.hint}>
                  {step3Fields.length ? 'Relevant fields for this activity type.' : 'Optional details.'}
                </Text>
                {step3Fields.map((f) => {
                  if (f.key === 'crop_stage') {
                    return (
                      <TextInput key={f.key} label={f.label} value={cropStage} onChangeText={setCropStage} mode="outlined" placeholder="e.g., Flowering" style={styles.input} />
                    );
                  }
                  if (f.key === 'germination_percent') {
                    return (
                      <TextInput key={f.key} label={f.label} value={germinationPercent} onChangeText={setGerminationPercent} keyboardType="decimal-pad" mode="outlined" placeholder="0-100" style={styles.input} />
                    );
                  }
                  if (f.key === 'survival_rate') {
                    return (
                      <TextInput key={f.key} label={f.label} value={survivalRatePercent} onChangeText={setSurvivalRatePercent} keyboardType="decimal-pad" mode="outlined" placeholder="0-100" style={styles.input} />
                    );
                  }
                  if (f.key === 'pests_diseases') {
                    return (
                      <TextInput key={f.key} label={f.label} value={pestsDiseases} onChangeText={setPestsDiseases} mode="outlined" placeholder="List any pests or diseases" style={styles.input} />
                    );
                  }
                  if (f.key === 'order_value') {
                    return (
                      <TextInput key={f.key} label={f.label} value={orderValue} onChangeText={setOrderValue} keyboardType="decimal-pad" mode="outlined" placeholder="Amount" style={styles.input} />
                    );
                  }
                  if (f.key === 'harvest_kgs') {
                    return (
                      <TextInput key={f.key} label={f.label} value={harvestKgs} onChangeText={setHarvestKgs} keyboardType="decimal-pad" mode="outlined" placeholder="Harvest in kilograms" style={styles.input} />
                    );
                  }
                  if (f.key === 'farmers_feedback') {
                    return (
                      <TextInput key={f.key} label={f.label} value={farmersFeedback} onChangeText={setFarmersFeedback} mode="outlined" multiline numberOfLines={2} placeholder="Farmer's comments" style={styles.input} />
                    );
                  }
                  return null;
                })}
              </Surface>

              {error ? (
                <HelperText type="error" style={styles.errorBlock}>{error}</HelperText>
              ) : null}

              <Surface style={styles.actionsSection} elevation={0}>
                <Button mode="outlined" onPress={() => setStep(1)} style={styles.nextBtn}>
                  Back
                </Button>
                <Button
                  mode="contained"
                  onPress={submit}
                  loading={submitting}
                  disabled={submitting}
                  style={styles.submitBtn}
                  accessibilityLabel="Record visit"
                >
                  Record Visit
                </Button>
              </Surface>
            </>
          )}

          <Modal
            visible={cameraModalVisible}
            animationType="slide"
            onRequestClose={() => setCameraModalVisible(false)}
          >
            <View style={styles.cameraModal}>
              <View style={styles.cameraModalHeader}>
                <Text variant="titleMedium" style={styles.cameraModalTitle}>
                  Take photo
                </Text>
                <Pressable
                  onPress={() => setCameraModalVisible(false)}
                  style={styles.cameraModalClose}
                  hitSlop={12}
                >
                  <Text variant="titleLarge" style={styles.cameraModalCloseText}>×</Text>
                </Pressable>
              </View>
              <View style={styles.cameraModalCamera}>
                <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />
                <View style={styles.cameraModalOverlay}>
                  <Pressable style={styles.captureButton} onPress={takePhoto}>
                    <View style={styles.captureButtonInner} />
                  </Pressable>
                  <Text variant="bodyMedium" style={styles.cameraModalHint}>
                    Tap to capture
                  </Text>
                </View>
              </View>
            </View>
          </Modal>

        </ScrollView>
      </KeyboardAvoidingView>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); setSubmitError(''); router.back(); }}>
          <Dialog.Icon icon={dialogSuccess ? 'check-circle' : 'alert'} color={dialogSuccess ? theme.colors.primary : theme.colors.error} />
          <Dialog.Title>{dialogSuccess ? 'Visit Verified' : 'Error'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {dialogSuccess ? (distanceM !== null ? `Distance: ${distanceM}m` : 'Visit recorded.') : (submitError || 'Failed to submit visit.')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setDialogVisible(false); setSubmitError(''); router.back(); }}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!snackbarMsg}
        onDismiss={() => setSnackbarMsg('')}
        duration={4000}
        wrapperStyle={[styles.snackbarWrapper, { top: insets.top }]}
        style={styles.snackbarTop}
      >
        {snackbarMsg}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  snackbarWrapper: { position: 'absolute', left: 0, right: 0 },
  snackbarTop: { marginHorizontal: 0 },
  snackbarGreen: { backgroundColor: colors.primary },
  container: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  topBtn: { marginTop: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerTitle: { fontWeight: '700', color: colors.gray900 },
  headerClose: { padding: spacing.sm },
  headerCloseText: { fontSize: 28, lineHeight: 32, opacity: 0.85, color: colors.gray700 },
  offlineChip: { marginBottom: spacing.md },
  section: {
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceVariant,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray100,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  locationBoxLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  locationIcon: { margin: 0, marginRight: spacing.md },
  locationStatus: { opacity: 0.85 },
  locationStatusError: { color: colors.error },
  photoEvidenceRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  photoEvidenceBtn: { flex: 1 },
  photoPreviewWrap: { marginTop: spacing.md, alignItems: 'center' },
  sectionTitle: { marginBottom: spacing.md },
  fieldLabel: { marginTop: spacing.xs, marginBottom: spacing.xs, fontWeight: '600', color: colors.gray700 },
  hint: { marginTop: spacing.xs, opacity: 0.85 },
  input: { marginBottom: spacing.md },
  inputHalf: { flex: 1, marginBottom: spacing.md },
  twoColRow: { flexDirection: 'row', gap: spacing.md, marginBottom: 0 },
  addFarmerBtn: { marginTop: -2, marginBottom: 2 },
  farmList: { marginTop: spacing.xs },
  farmSelectWrap: { marginTop: spacing.sm },
  lockedHint: { marginTop: 2, marginBottom: 4 },
  errorHint: { marginTop: 4, marginBottom: 0 },
  scheduleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  scheduleChip: { marginBottom: 0 },
  card: { marginBottom: spacing.md },
  divider: { marginVertical: spacing.xs },
  progressBar: { height: 6, borderRadius: radius.sm, marginVertical: spacing.xs },
  chip: { alignSelf: 'flex-start', marginTop: spacing.xs },
  locationLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationLoadingText: { opacity: 0.8 },
  photoContent: { alignItems: 'center', overflow: 'hidden' },
  previewImg: { width: '100%', height: 200, borderRadius: radius.card, marginBottom: spacing.md },
  retakeBtn: { marginTop: spacing.xs },
  takePhotoBtn: { minWidth: 160 },
  cameraModal: { flex: 1, backgroundColor: '#000' },
  cameraModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraModalTitle: { color: '#fff' },
  cameraModalClose: { padding: 8 },
  cameraModalCloseText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  cameraModalCamera: { flex: 1, position: 'relative' },
  cameraModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 48,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 4,
    borderColor: '#1B8F3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  cameraModalHint: { color: '#fff', marginTop: 12 },
  accordion: { marginTop: 4 },
  accordionInner: { paddingHorizontal: 12, paddingBottom: 12 },
  errorBlock: { marginVertical: 4 },
  actionsSection: { paddingTop: 12, paddingBottom: 4 },
  nextBtn: { marginBottom: 8 },
  submitBtn: { marginBottom: 0 },
  stepperRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: 4,
  },
  stepperStep: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: colors.gray100,
  },
  stepperStepActive: {
    backgroundColor: colors.primary + '20',
  },
  stepperStepText: { color: colors.gray500 },
  stepperStepTextActive: { color: colors.primary, fontWeight: '600' },
  stepActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.lg },
});
