import {
  getFarmers as getFarmersDb,
  getFarms as getFarmsDb,
  getPlannedSchedules as getPlannedSchedulesDb,
  getScheduleIdsWithRecordedVisits,
} from '@/database';
import { useAuth } from '@/contexts/AuthContext';
import { appMeta$ } from '@/store/observable';
import { api, getLabels, type ActivityFormFieldOption, type ActivityTypeOption, type Farm, type Farmer, type Schedule, type VisitSettings } from '@/lib/api';
import { ACTIVITY_TYPES, DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';
import { buildStep3Payload, getStep3InputType, type Step3Values } from '@/lib/constants/visitFormFields';
import { validateRecordVisit } from '@/lib/validateRecordVisit';
import { enqueueVisit, syncWithServer } from '@/lib/syncWithServer';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
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
import { SelectActivityTypesModal } from '@/components/SelectActivityTypesModal';
import { SelectFarmModal } from '@/components/SelectFarmModal';
import {
  colors,
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_WARNING_DISTANCE_METERS,
  formHeaderHeight,
  radius,
  scrollPaddingKeyboard,
  spacing,
} from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoTakenAts, setPhotoTakenAts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [plannedSchedules, setPlannedSchedules] = useState<Schedule[]>([]);
  const [scheduleIdsWithRecordedVisits, setScheduleIdsWithRecordedVisits] = useState<Set<string>>(new Set());
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(params.scheduleId ?? null);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(params.farmerId ?? null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [activityTypes, setActivityTypes] = useState<string[]>([DEFAULT_ACTIVITY_TYPE]);
  const [activityTypesList, setActivityTypesList] = useState<ActivityTypeOption[]>([]);
  const [farmerMenuOpen, setFarmerMenuOpen] = useState(false);
  const [farmModalOpen, setFarmModalOpen] = useState(false);
  const [activityTypesModalOpen, setActivityTypesModalOpen] = useState(false);
  const [accordionExpanded, setAccordionExpanded] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [step3Values, setStep3Values] = useState<Step3Values>({});
  const [productFocusMenuOpen, setProductFocusMenuOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogSuccess, setDialogSuccess] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [visitSettings, setVisitSettings] = useState<VisitSettings | null>(null);
  const [step, setStep] = useState(0); // 0 = schedule, 1 = details & photo, 2 = additional fields

  const options = useSelector(() => appMeta$.cachedOptions.get());
  const labels = useSelector(() => getLabels(options));
  const products = useSelector(() => options?.products ?? []);
  const visitFormFieldSchema = useSelector(() => options?.visit_form_field_schema ?? null);
  const defaultVisitFormFields = useSelector(() => options?.default_visit_form_fields ?? []);
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

  const applyOptions = useCallback((o: import('@/lib/api').OptionsResponse) => {
    setVisitSettings(o.visit_settings ?? { max_distance_meters: DEFAULT_MAX_DISTANCE_METERS, warning_distance_meters: DEFAULT_WARNING_DISTANCE_METERS });
    if (o.activity_types?.length) {
      const activeOnly = o.activity_types.filter((a) => a.is_active !== false);
      setActivityTypesList(activeOnly);
      setActivityTypes((prev) => {
        const allowed = activeOnly.map((a) => a.value);
        const kept = prev.filter((v) => allowed.includes(v));
        if (kept.length > 0) return kept;
        return [activeOnly[0]?.value ?? DEFAULT_ACTIVITY_TYPE];
      });
    } else {
      setActivityTypesList(ACTIVITY_TYPES.map((a) => ({ value: a.value, label: a.label })));
    }
  }, []);

  useEffect(() => {
    api
      .getOptions()
      .then((o) => {
        appMeta$.cachedOptions.set(o);
        applyOptions(o);
      })
      .catch(() => {
        const cached = appMeta$.cachedOptions.get();
        if (cached) {
          applyOptions(cached);
        } else {
          setVisitSettings({ max_distance_meters: DEFAULT_MAX_DISTANCE_METERS, warning_distance_meters: DEFAULT_WARNING_DISTANCE_METERS });
          setActivityTypesList(ACTIVITY_TYPES.map((a) => ({ value: a.value, label: a.label })));
        }
      });
  }, [applyOptions]);

  const activityTypeOptions = useMemo(() => {
    const list = activityTypesList.length
      ? activityTypesList
      : ACTIVITY_TYPES.map((a) => ({ value: a.value, label: a.label }));
    return list.filter((a) => (a as ActivityTypeOption).is_active !== false);
  }, [activityTypesList]);

  // Step 3 form fields: only from selected activity types that are active. No fields from inactive or non-selected activities.
  const step3Fields = useMemo(() => {
    const activeOnlyList = activityTypesList.filter((a) => (a as ActivityTypeOption).is_active !== false);
    const activeSet = new Set(activeOnlyList.map((a) => a.value));
    const seen = new Set<string>();
    const out: ActivityFormFieldOption[] = [];
    for (const value of activityTypes) {
      if (!activeSet.has(value)) continue; // only selected activities that are active
      const config = activeOnlyList.find((a) => a.value === value);
      const fields = config?.form_fields?.length ? config.form_fields : defaultVisitFormFields;
      for (const f of fields) {
        if (!seen.has(f.key)) {
          seen.add(f.key);
          out.push(f);
        }
      }
    }
    return out;
  }, [activityTypes, activityTypesList, defaultVisitFormFields]);

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

  // When Select Activity modal opens and we're online, refresh options so only active activity types are shown
  useEffect(() => {
    if (!activityTypesModalOpen || !isOnline) return;
    api.getOptions().then((o) => {
      appMeta$.cachedOptions.set(o);
      applyOptions(o);
    }).catch(() => { /* keep existing cache */ });
  }, [activityTypesModalOpen, isOnline, applyOptions]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const farmerId = params.farmerId;
      // Refetch options on focus so active activity types and form_fields are up to date
      api.getOptions().then((o) => {
        if (!cancelled) {
          appMeta$.cachedOptions.set(o);
          applyOptions(o);
        }
      }).catch(() => { /* keep existing cache */ });
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
    }, [params.farmerId, userId, applyOptions])
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
        setPhotoUris((prev) => [...prev, photo.uri]);
        setPhotoTakenAts((prev) => [...prev, takenAt]);
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

  // When schedule list didn't load we may have selectedScheduleId from params but no selectedSchedule — allow submit and let server validate
  const mustSelectSchedule = !selectedScheduleId || (selectedSchedule != null && selectedSchedule.status !== 'accepted');
  const scheduleLocked = !!selectedScheduleId && selectedSchedule?.status === 'accepted';
  const scheduleIdForSubmit = selectedScheduleId ?? undefined;

  const submit = useCallback(async () => {
    const validation = validateRecordVisit({
      scheduleIdForSubmit,
      mustSelectSchedule,
      acceptedSchedulesLength: acceptedSchedules.length,
      selectedFarmerId,
      location,
      photoUrisLength: photoUris.length,
      step3Fields,
      step3Values,
      visitFormFieldSchema,
      activityTypes,
      activityTypesList,
      notes,
      distanceM,
      maxDistanceM: maxM,
      partnerLabel: labels.partner,
    });
    if (!validation.valid) {
      setError(validation.error ?? 'Please fix the errors below.');
      return;
    }
    if (!selectedFarmerId || !location) return; // validation ensures these; narrows types for TS
    setSubmitting(true);
    setError('');
    try {
      const photoPlaceName = selectedFarm?.village ?? selectedFarmer?.display_name ?? 'Visit location';
      const step3Payload = buildStep3Payload(step3Values, visitFormFieldSchema);

      // Always try API first so we don't rely on NetInfo (which can be wrong when online)
      try {
        await api.createVisit({
          farmer_id: selectedFarmerId,
          farm_id: selectedFarmId || undefined,
          schedule_id: scheduleIdForSubmit,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          photos: photoUris.map((uri, i) => ({ uri, type: 'image/jpeg', name: `visit_${i}.jpg` })),
          photo_taken_at: photoTakenAts[0] ?? new Date().toISOString(),
          photo_device_info: getPhotoDeviceInfo(),
          photo_place_name: photoPlaceName,
          activity_types: activityTypes.length > 0 ? activityTypes : [DEFAULT_ACTIVITY_TYPE],
          activity_type: activityTypes[0] ?? DEFAULT_ACTIVITY_TYPE,
          notes: notes || undefined,
          ...step3Payload,
        });
        if (scheduleIdForSubmit) {
          setScheduleIdsWithRecordedVisits((prev) => new Set(prev).add(scheduleIdForSubmit));
        }
        setDialogSuccess(true);
        setDialogVisible(true);
        return;
      } catch (apiError) {
        // Validation (4xx): show error and do not enqueue so user can fix and retry
        const isValidation = apiError && typeof apiError === 'object' && 'isValidation' in apiError && (apiError as Error & { isValidation?: boolean }).isValidation;
        if (isValidation) {
          const msg = apiError instanceof Error ? apiError.message : 'Failed to submit visit.';
          setSubmitError(msg);
          setError(msg);
          setDialogSuccess(false);
          setDialogVisible(true);
          setSubmitting(false);
          return;
        }
        // Network or server error — save for sync and try once now
      }

      await enqueueVisit({
        farmer_id: selectedFarmerId,
        farm_id: selectedFarmId || undefined,
        schedule_id: scheduleIdForSubmit,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        photo_uris: photoUris,
        photo_taken_at: photoTakenAts[0] ?? new Date().toISOString(),
        photo_device_info: getPhotoDeviceInfo(),
        photo_place_name: photoPlaceName,
        notes: notes || undefined,
        activity_types: activityTypes.length > 0 ? activityTypes : [DEFAULT_ACTIVITY_TYPE],
        activity_type: activityTypes[0] ?? DEFAULT_ACTIVITY_TYPE,
        ...step3Payload,
      });
      if (scheduleIdForSubmit) {
        setScheduleIdsWithRecordedVisits((prev) => new Set(prev).add(scheduleIdForSubmit));
      }

      const syncResult = await syncWithServer();
      if (syncResult.success) {
        setSnackbarMsg('Visit saved and synced.');
      } else {
        setSnackbarMsg(
          `Visit saved. Could not sync now${syncResult.error ? `: ${syncResult.error}` : ''}. Will retry automatically.`
        );
      }
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit visit.');
      setDialogSuccess(false);
      setDialogVisible(true);
    } finally {
      setSubmitting(false);
    }
  }, [scheduleIdForSubmit, mustSelectSchedule, acceptedSchedules.length, selectedFarmerId, selectedFarmId, location, photoUris, photoTakenAts, step3Fields, step3Values, visitFormFieldSchema, activityTypes, activityTypesList, notes, distanceM, maxM, labels.partner, router]);

  const activityLabel = useMemo(() => {
    if (activityTypes.length === 0) return 'Select activities';
    const labels = activityTypes.map(
      (v) =>
        activityTypesList.find((a) => a.value === v)?.label ??
        ACTIVITY_TYPES.find((a) => a.value === v)?.label ??
        v
    );
    return labels.join(', ');
  }, [activityTypes, activityTypesList]);

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
        <View style={styles.headerLeft}>
          <Text variant="labelSmall" style={styles.headerStepLabel}>
            STEP {step + 1} OF 3
          </Text>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Record Visit
          </Text>
        </View>
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

          {/* Stepper: checkmark for completed, number for current, grey for future */}
          <View style={styles.stepperRow}>
            <Pressable onPress={() => setStep(0)} style={styles.stepperItem} disabled={false}>
              <View style={[styles.stepperCircle, (step === 0 || step >= 1) && styles.stepperCircleActive]}>
                {step >= 1 ? (
                  <MaterialCommunityIcons name="check" size={18} color={colors.white} />
                ) : (
                  <Text variant="labelMedium" style={[styles.stepperCircleText, step === 0 && styles.stepperCircleTextActive]}>1</Text>
                )}
              </View>
              <Text variant="labelSmall" style={[styles.stepperLabel, (step === 0 || step >= 1) && styles.stepperLabelActive]}>Schedule</Text>
            </Pressable>
            <View style={[styles.stepperLine, step >= 1 && styles.stepperLineActive]} />
            <Pressable onPress={() => step >= 1 && setStep(1)} style={styles.stepperItem} disabled={step < 1}>
              <View style={[styles.stepperCircle, (step === 1 || step >= 2) && styles.stepperCircleActive]}>
                {step >= 2 ? (
                  <MaterialCommunityIcons name="check" size={18} color={colors.white} />
                ) : (
                  <Text variant="labelMedium" style={[styles.stepperCircleText, step === 1 && styles.stepperCircleTextActive]}>2</Text>
                )}
              </View>
              <Text variant="labelSmall" style={[styles.stepperLabel, (step === 1 || step >= 2) && styles.stepperLabelActive]}>Details</Text>
            </Pressable>
            <View style={[styles.stepperLine, step >= 2 && styles.stepperLineActive]} />
            <Pressable onPress={() => step >= 2 && setStep(2)} style={styles.stepperItem} disabled={step < 2}>
              <View style={[styles.stepperCircle, step === 2 && styles.stepperCircleActive]}>
                <Text variant="labelMedium" style={[styles.stepperCircleText, step === 2 && styles.stepperCircleTextActive]}>3</Text>
              </View>
              <Text variant="labelSmall" style={[styles.stepperLabel, step === 2 && styles.stepperLabelActive]}>Additional</Text>
            </Pressable>
          </View>

          {/* Step 1: Select schedule */}
          {step === 0 && (
            <>
              {acceptedSchedules.length > 0 ? (
                <Surface style={styles.section} elevation={0}>
                  <Text variant="labelLarge" style={styles.fieldLabel}>Planned visit (accepted) *</Text>
                  <Text variant="bodySmall" style={styles.hint}>
                    {`Select the accepted schedule for this visit. ${labels.partner} and ${labels.location.toLowerCase()} are set from the schedule.`}
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
                          {dateStr} — {farmerName} · {labels.location}: {s.farm_display_name ?? 'None'}
                        </Chip>
                      );
                    })}
                  </View>
                  {mustSelectSchedule && (
                    <HelperText type="error" style={styles.errorHint}>Select a planned visit to continue.</HelperText>
                  )}
                </Surface>
              ) : (
                <>
                  <View style={styles.warningBox}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.warning} style={styles.warningBoxIcon} />
                    <View style={styles.warningBoxContent}>
                      <Text variant="labelLarge" style={styles.warningBoxTitle}>No Scheduled Visit Found</Text>
                      <Text variant="bodySmall" style={styles.warningBoxText}>
                        Visits can only be recorded for a planned schedule dated today or earlier. Please check your schedule list.
                      </Text>
                    </View>
                  </View>
                </>
              )}
              <View style={styles.stepActions}>
                <Button
                  mode="contained"
                  onPress={() => setStep(1)}
                  disabled={mustSelectSchedule}
                  style={styles.nextBtn}
                  contentStyle={styles.nextBtnContent}
                  icon="arrow-right"
                >
                  Next: Details & Photo
                </Button>
              </View>
            </>
          )}

          {/* Step 2: Farmer/farm details, activity, photo, location */}
          {step === 1 && (
            <>
              <Text variant="labelMedium" style={styles.step2SectionTitle}>{labels.partner.toUpperCase()} & {labels.location.toUpperCase()} (from schedule)</Text>
              {selectedFarmer && (
                <View style={styles.farmerCard}>
                  <View style={styles.farmerCardAvatar}>
                    <Text variant="titleLarge" style={styles.farmerCardAvatarText}>
                      {(selectedFarmer.display_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.farmerCardBody}>
                    <Text variant="titleMedium" style={styles.farmerCardName}>{selectedFarmer.display_name ?? '—'}</Text>
                    {selectedFarmer.phone ? (
                      <View style={styles.farmerCardPhone}>
                        <MaterialCommunityIcons name="phone" size={16} color="#DB2777" />
                        <Text variant="bodySmall" style={styles.farmerCardPhoneText}>{selectedFarmer.phone}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.farmerCardTag}>
                    <Chip mode="flat" style={styles.activeChip} textStyle={styles.activeChipText} compact>Active</Chip>
                  </View>
                </View>
              )}

              <Text variant="labelMedium" style={styles.step2SectionTitle}>{labels.location.toUpperCase()} (optional)</Text>
              {(scheduleLockedForFarm && selectedFarm) ? (
                <View style={styles.farmDisplay}>
                  <Text variant="bodyLarge">{selectedFarm.village}{selectedFarm.crop_type ? ` · ${selectedFarm.crop_type}` : ''}</Text>
                </View>
              ) : selectedFarmer && !scheduleLockedForFarm ? (
                farms.length === 0 ? (
                  <Text variant="bodySmall" style={styles.muted}>No {labels.location.toLowerCase()}s for this {labels.partner.toLowerCase()}</Text>
                ) : (
                  <>
                    <Button
                      mode="outlined"
                      onPress={() => setFarmModalOpen(true)}
                      style={styles.farmSelectBtn}
                      contentStyle={styles.farmSelectBtnContent}
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
                )
              ) : null}

              <Text variant="labelMedium" style={styles.step2SectionTitle}>ACTIVITY TYPES</Text>
              <Text variant="bodySmall" style={styles.hint}>You can record more than one activity per visit.</Text>
              <Button
                mode="outlined"
                onPress={() => setActivityTypesModalOpen(true)}
                style={styles.farmSelectBtn}
                contentStyle={styles.farmSelectBtnContent}
                icon="format-list-checks"
              >
                {activityLabel}
              </Button>
              <SelectActivityTypesModal
                visible={activityTypesModalOpen}
                onClose={() => setActivityTypesModalOpen(false)}
                options={activityTypeOptions}
                selectedValues={activityTypes}
                onSelect={setActivityTypes}
                title="Select activities"
              />

              {/* Location: green card when verified, otherwise neutral/warning */}
              <View style={[styles.locationCard, location && gpsValid && styles.locationCardVerified]}>
                <View style={styles.locationCardLeft}>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={24}
                    color={location && gpsValid ? colors.primary : colors.gray500}
                    style={styles.locationCardIcon}
                  />
                  <View style={styles.locationCardText}>
                    {locationError ? (
                      <>
                        <Text variant="labelLarge" style={styles.locationCardTitle}>Location</Text>
                        <Text variant="bodySmall" style={styles.locationStatusError}>{locationError}</Text>
                      </>
                    ) : locationLoading ? (
                      <>
                        <Text variant="labelLarge" style={styles.locationCardTitle}>Location</Text>
                        <Text variant="bodySmall" style={styles.locationStatus}>Getting location…</Text>
                      </>
                    ) : location && gpsValid && distanceM !== null ? (
                      <>
                        <Text variant="labelLarge" style={styles.locationCardTitleVerified}>Location Verified ✓</Text>
                        <Text variant="bodySmall" style={styles.locationCardDetail}>
                          {distanceM}m away · within {maxM}m limit
                        </Text>
                      </>
                    ) : location ? (
                      <>
                        <Text variant="labelLarge" style={styles.locationCardTitle}>
                          {distanceM !== null && !gpsValid ? 'Out of range' : 'Location'}
                        </Text>
                        <Text variant="bodySmall" style={styles.locationStatus}>
                          {distanceM !== null ? `${distanceM}m (max ${maxM}m)` : 'Location captured'}
                        </Text>
                        {distanceM !== null && !gpsValid && (
                          <HelperText type="error">Must be within {maxM}m to record this visit.</HelperText>
                        )}
                      </>
                    ) : (
                      <>
                        <Text variant="labelLarge" style={styles.locationCardTitle}>Location</Text>
                        <Text variant="bodySmall" style={styles.locationStatus}>Location not captured</Text>
                      </>
                    )}
                  </View>
                </View>
                <Pressable onPress={refreshLocation} disabled={locationLoading} style={styles.locationRefreshBtn}>
                  <MaterialCommunityIcons name="refresh" size={24} color={location && gpsValid ? colors.primary : colors.gray500} />
                </Pressable>
              </View>

              <Text variant="labelMedium" style={styles.step2SectionTitle}>PHOTO EVIDENCE *</Text>
              <Text variant="bodySmall" style={styles.hint}>You can add more than one photo. At least one required.</Text>
              {photoUris.length > 0 ? (
                <View style={styles.photosRow}>
                  {photoUris.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
                      <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                      <Button
                        mode="text"
                        compact
                        icon="close"
                        onPress={() => {
                          setPhotoUris((prev) => prev.filter((_, i) => i !== index));
                          setPhotoTakenAts((prev) => prev.filter((_, i) => i !== index));
                        }}
                        style={styles.photoThumbRemove}
                        accessibilityLabel="Remove photo"
                      >
                        {' '}
                      </Button>
                    </View>
                  ))}
                  <Pressable style={styles.photoAddBtn} onPress={openCameraModal}>
                    <MaterialCommunityIcons name="camera-plus" size={40} color={colors.primary} />
                    <Text variant="bodySmall" style={styles.photoAddLabel}>Add photo</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.photoPlaceholder} onPress={openCameraModal}>
                  <MaterialCommunityIcons name="camera" size={48} color={colors.gray500} />
                  <Text variant="bodyLarge" style={styles.photoPlaceholderText}>Tap to take photo</Text>
                  <Text variant="bodySmall" style={styles.photoPlaceholderHint}>At least one required for verification</Text>
                </Pressable>
              )}

              <View style={styles.stepActions}>
                <Button mode="outlined" onPress={() => setStep(0)} style={styles.nextBtn}>
                  Back
                </Button>
                <Button
                  mode="contained"
                  onPress={() => setStep(2)}
                  disabled={
                    photoUris.length === 0 ||
                    !location ||
                    (location && distanceM !== null && !gpsValid)
                  }
                  style={styles.nextBtn}
                  contentStyle={styles.nextBtnContent}
                  icon="arrow-right"
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
                  const requiredLabel = f.required ? `${f.label} (required)` : f.label;
                  const value = step3Values[f.key] ?? '';
                  const setValue = (v: string) => setStep3Values((prev) => ({ ...prev, [f.key]: v }));
                  const inputType = getStep3InputType(f.key, visitFormFieldSchema);
                  if (inputType === 'product') {
                    const selectedProduct = products.find((p) => p.id === value);
                    return (
                      <View key={f.key} style={styles.input}>
                        <Text variant="labelLarge" style={styles.fieldLabel}>{requiredLabel}</Text>
                        <Menu
                          visible={productFocusMenuOpen}
                          onDismiss={() => setProductFocusMenuOpen(false)}
                          anchor={
                            <Button
                              mode="outlined"
                              onPress={() => setProductFocusMenuOpen(true)}
                              contentStyle={{ justifyContent: 'flex-start' }}
                              style={styles.productFocusButton}
                            >
                              {selectedProduct ? `${selectedProduct.name}${selectedProduct.unit ? ` (${selectedProduct.unit})` : ''}` : 'Select product'}
                            </Button>
                          }
                        >
                          <List.Item title="None" onPress={() => { setValue(''); setProductFocusMenuOpen(false); }} />
                          {products.map((p) => (
                            <List.Item
                              key={p.id}
                              title={`${p.name}${p.unit ? ` (${p.unit})` : ''}`}
                              onPress={() => { setValue(p.id); setProductFocusMenuOpen(false); }}
                            />
                          ))}
                        </Menu>
                      </View>
                    );
                  }
                  return (
                    <TextInput
                      key={f.key}
                      label={requiredLabel}
                      value={value}
                      onChangeText={setValue}
                      mode="outlined"
                      keyboardType={inputType === 'number' ? 'decimal-pad' : inputType === 'integer' ? 'number-pad' : undefined}
                      multiline={inputType === 'multiline'}
                      numberOfLines={inputType === 'multiline' ? 2 : undefined}
                      placeholder={f.label}
                      style={styles.input}
                    />
                  );
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
  headerLeft: { flex: 1 },
  headerStepLabel: { color: colors.gray500, marginBottom: 2 },
  headerTitle: { fontWeight: '700', color: colors.gray900 },
  headerClose: { padding: spacing.sm },
  headerCloseText: { fontSize: 28, lineHeight: 32, opacity: 0.85, color: colors.gray700 },
  offlineChip: { marginBottom: spacing.md },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.warningLight,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  warningBoxIcon: { marginRight: spacing.md },
  warningBoxContent: { flex: 1 },
  warningBoxTitle: { color: colors.warning, fontWeight: '600', marginBottom: 4 },
  warningBoxText: { color: colors.gray900 },
  nextBtnContent: { flexDirection: 'row-reverse' },
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
  productFocusButton: { marginBottom: spacing.md },
  twoColRow: { flexDirection: 'row', gap: spacing.md, marginBottom: 0 },
  addFarmerBtn: { marginTop: -2, marginBottom: 2 },
  farmList: { marginTop: spacing.xs },
  farmSelectWrap: { marginTop: spacing.sm },
  step2SectionTitle: {
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    letterSpacing: 0.5,
  },
  farmerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  farmerCardAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  farmerCardAvatarText: { color: colors.white, fontWeight: '700' },
  farmerCardBody: { flex: 1, minWidth: 0 },
  farmerCardName: { fontWeight: '700', color: colors.gray900 },
  farmerCardPhone: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  farmerCardPhoneText: { color: colors.gray700 },
  farmerCardTag: { marginLeft: spacing.sm },
  activeChip: { backgroundColor: colors.primary },
  activeChipText: { color: colors.white, fontWeight: '600', fontSize: 12 },
  farmDisplay: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  farmSelectBtn: { marginBottom: 4 },
  farmSelectBtnContent: { justifyContent: 'flex-start' },
  muted: { opacity: 0.7 },
  step2Input: { marginBottom: spacing.md },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray100,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  locationCardVerified: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  locationCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  locationCardIcon: { marginRight: spacing.md },
  locationCardText: { flex: 1 },
  locationCardTitle: { fontWeight: '600', color: colors.gray700 },
  locationCardTitleVerified: { fontWeight: '600', color: colors.primary },
  locationCardDetail: { color: colors.gray700, marginTop: 2 },
  locationRefreshBtn: { padding: spacing.sm },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'flex-start' },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: radius.sm },
  photoThumbRemove: { position: 'absolute', top: -4, right: -4, minWidth: 28, margin: 0 },
  photoAddBtn: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight + '40',
  },
  photoAddLabel: { marginTop: 4, color: colors.primary },
  photoPlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    borderRadius: radius.card,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.gray100,
  },
  photoPlaceholderText: { color: colors.gray700, marginTop: spacing.md },
  photoPlaceholderHint: { color: colors.gray500, marginTop: spacing.xs },
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
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  stepperItem: {
    alignItems: 'center',
    minWidth: 56,
  },
  stepperCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperCircleActive: {
    backgroundColor: colors.primary,
  },
  stepperCircleText: { color: colors.gray500, fontWeight: '600' },
  stepperCircleTextActive: { color: colors.white, fontWeight: '600' },
  stepperLabel: { marginTop: 4, color: colors.gray500, fontSize: 12 },
  stepperLabelActive: { color: colors.primary, fontWeight: '600' },
  stepperLine: {
    flex: 1,
    height: 3,
    backgroundColor: colors.gray200,
    marginHorizontal: 4,
    marginBottom: 20,
    borderRadius: 2,
  },
  stepperLineActive: {
    backgroundColor: colors.primary,
  },
  stepActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.lg },
});
