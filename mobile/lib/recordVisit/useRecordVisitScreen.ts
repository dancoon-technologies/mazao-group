import {
  getFarmers as getFarmersDb,
  getFarms as getFarmsDb,
  getPlannedSchedules as getPlannedSchedulesDb,
  getScheduleIdsWithRecordedVisits,
} from '@/database';
import { useAuth } from '@/contexts/AuthContext';
import { appMeta$ } from '@/store/observable';
import {
  api,
  getLabels,
  type ActivityFormFieldOption,
  type ActivityTypeOption,
  type Farm,
  type Farmer,
  type Route,
  type RouteStop,
  type Schedule,
  type VisitSettings,
} from '@/lib/api';
import { ACTIVITY_TYPES, DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';
import { buildStep3Payload, type Step3Values } from '@/lib/constants/visitFormFields';
import { validateRecordVisit } from '@/lib/validateRecordVisit';
import { enqueueVisit, syncWithServer } from '@/lib/syncWithServer';
import { farmerRowToFarmer, farmRowToFarm, scheduleRowToSchedule } from '@/lib/offline-helpers';
import { haversineDistance, getPhotoDeviceInfo } from '@/lib/recordVisit/utils';
import type { VisitProductLine } from '@/lib/recordVisit/types';
import NetInfo from '@react-native-community/netinfo';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_WARNING_DISTANCE_METERS,
} from '@/constants/theme';

export function useRecordVisitScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const params = useLocalSearchParams<{
    farmerId?: string;
    farmId?: string;
    scheduleId?: string;
    routeId?: string;
    routeStopId?: string;
  }>();
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
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedRouteStopId, setSelectedRouteStopId] = useState<string | null>(null);
  const [todayRoutes, setTodayRoutes] = useState<Route[]>([]);
  const [todayRoute, setTodayRoute] = useState<Route | null>(null);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(params.farmerId ?? null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [activityTypes, setActivityTypes] = useState<string[]>([DEFAULT_ACTIVITY_TYPE]);
  const [activityTypesList, setActivityTypesList] = useState<ActivityTypeOption[]>([]);
  const [farmerModalOpen, setFarmerModalOpen] = useState(false);
  const [farmerModalTitle, setFarmerModalTitle] = useState<string | null>(null);
  const [farmModalOpen, setFarmModalOpen] = useState(false);
  const [recordingWithoutPlan, setRecordingWithoutPlan] = useState(false);
  const [activityTypesModalOpen, setActivityTypesModalOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [step3Values, setStep3Values] = useState<Step3Values>({});
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productModalFieldKey, setProductModalFieldKey] = useState<string | null>(null);
  const [productLines, setProductLines] = useState<VisitProductLine[]>([]);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogSuccess, setDialogSuccess] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [visitSettings, setVisitSettings] = useState<VisitSettings | null>(null);
  const [step, setStep] = useState(0);
  const [activityTypesOptionsRefreshing, setActivityTypesOptionsRefreshing] = useState(false);

  const options = useSelector(() => appMeta$.cachedOptions.get());
  const labels = useSelector(() => getLabels(options));
  const products = useSelector(() => options?.products ?? []);
  const visitFormFieldSchema = useSelector(() => options?.visit_form_field_schema ?? null);

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
  const gpsValid = distanceM === null || distanceM <= maxM;

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
      setActivityTypesList([]);
    }
  }, []);

  useEffect(() => {
    api
      .getOptions()
      .then((o) => {
        const existing = appMeta$.cachedOptions.get();
        const hasNewActivityTypes = Array.isArray(o?.activity_types) && o.activity_types.length > 0;
        const merged = {
          ...o,
          activity_types: hasNewActivityTypes ? o.activity_types : (existing?.activity_types ?? []),
        };
        appMeta$.cachedOptions.set(merged);
        applyOptions(merged);
      })
      .catch(() => {
        const cached = appMeta$.cachedOptions.get();
        if (cached) {
          applyOptions(cached);
        } else {
          setVisitSettings({ max_distance_meters: DEFAULT_MAX_DISTANCE_METERS, warning_distance_meters: DEFAULT_WARNING_DISTANCE_METERS });
          setActivityTypesList([]);
        }
      });
  }, [applyOptions]);

  const activityTypeOptions = useMemo(() => {
    const list = options?.activity_types ?? activityTypesList;
    return list.filter((a) => (a as ActivityTypeOption).is_active !== false);
  }, [options?.activity_types, activityTypesList]);

  const step3Fields = useMemo(() => {
    const list = options?.activity_types ?? activityTypesList;
    const activeOnlyList = list.filter((a) => (a as ActivityTypeOption).is_active !== false);
    const activeSet = new Set(activeOnlyList.map((a) => a.value));
    const seen = new Set<string>();
    const out: ActivityFormFieldOption[] = [];
    for (const value of activityTypes) {
      if (!activeSet.has(value)) continue;
      const config = activeOnlyList.find((a) => a.value === value);
      const activityFormFields = config?.form_fields;
      const fields = Array.isArray(activityFormFields) && activityFormFields.length > 0 ? activityFormFields : [];
      for (const f of fields) {
        if (!seen.has(f.key)) {
          seen.add(f.key);
          out.push(f);
        }
      }
    }
    if (selectedFarmer?.is_stockist && !seen.has('stockist_payment_amount')) {
      out.push({
        key: 'stockist_payment_amount',
        label: 'Stockist payment amount',
        required: false,
      });
    }
    return out;
  }, [activityTypes, activityTypesList, options?.activity_types, selectedFarmer?.is_stockist]);

  useEffect(() => {
    const keys = new Set(step3Fields.map((f) => f.key));
    setStep3Values((prev) => {
      let changed = false;
      const next: Step3Values = {};
      for (const [k, v] of Object.entries(prev)) {
        if (keys.has(k)) next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [step3Fields]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getFarmersDb();
        if (cancelled) return;
        setFarmers(rows.map(farmerRowToFarmer));
      } catch {
        if (!cancelled) setFarmers([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isOnline === true) {
      syncWithServer().catch(() => { });
    }
  }, [isOnline]);

  useEffect(() => {
    if (params.farmerId) setSelectedFarmerId(params.farmerId);
  }, [params.farmerId]);

  useEffect(() => {
    const fid =
      typeof params.farmId === 'string'
        ? params.farmId
        : Array.isArray(params.farmId)
          ? params.farmId[0]
          : undefined;
    if (fid) setSelectedFarmId(fid);
  }, [params.farmId]);

  useEffect(() => {
    if (!activityTypesModalOpen) {
      setActivityTypesOptionsRefreshing(false);
      return;
    }
    if (!isOnline) {
      setActivityTypesOptionsRefreshing(false);
      return;
    }
    setActivityTypesOptionsRefreshing(true);
    api.getOptions().then((o) => {
      const existing = appMeta$.cachedOptions.get();
      const hasNewActivityTypes = Array.isArray(o?.activity_types) && o.activity_types.length > 0;
      const merged = {
        ...o,
        activity_types: hasNewActivityTypes ? o.activity_types : (existing?.activity_types ?? []),
      };
      appMeta$.cachedOptions.set(merged);
      applyOptions(merged);
    }).catch(() => { /* keep existing cache */ }).finally(() => setActivityTypesOptionsRefreshing(false));
  }, [activityTypesModalOpen, isOnline, applyOptions]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const farmerId = params.farmerId;
      api.getOptions().then((o) => {
        if (!cancelled) {
          const existing = appMeta$.cachedOptions.get();
          const hasNewActivityTypes = Array.isArray(o?.activity_types) && o.activity_types.length > 0;
          const merged = {
            ...o,
            activity_types: hasNewActivityTypes ? o.activity_types : (existing?.activity_types ?? []),
          };
          appMeta$.cachedOptions.set(merged);
          applyOptions(merged);
        }
      }).catch(() => { /* keep existing cache */ });
      (async () => {
        try {
          const rows = await getFarmersDb();
          if (cancelled) return;
          setFarmers(rows.map(farmerRowToFarmer));
          if (farmerId) setSelectedFarmerId(farmerId);
          const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
          if (connected && !cancelled) {
            try {
              const remote = await api.getFarmers();
              if (!cancelled && Array.isArray(remote) && remote.length > 0) {
                setFarmers(remote);
              }
            } catch {
              /* keep local list */
            }
          }
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
          setPlannedSchedules(scheduleRows.map(scheduleRowToSchedule));
          const recordedSet = await getScheduleIdsWithRecordedVisits(userId);
          if (!cancelled) setScheduleIdsWithRecordedVisits(recordedSet);
        } catch {
          if (!cancelled) setPlannedSchedules([]);
        }
        (async () => {
          const routeIdParam =
            typeof params.routeId === 'string'
              ? params.routeId
              : Array.isArray(params.routeId)
                ? params.routeId[0]
                : undefined;
          const routeStopParam =
            typeof params.routeStopId === 'string'
              ? params.routeStopId
              : Array.isArray(params.routeStopId)
                ? params.routeStopId[0]
                : undefined;
          try {
            if (routeIdParam) {
              const r = await api.getRoute(routeIdParam);
              if (cancelled) return;
              setTodayRoutes([r]);
              setTodayRoute(r);
              setSelectedScheduleId(null);
              setRecordingWithoutPlan(false);
              if (routeStopParam) {
                const stop = (r.stops ?? []).find((s) => s.id === routeStopParam);
                if (stop) {
                  setSelectedRouteId(r.id);
                  setSelectedRouteStopId(stop.id);
                  setSelectedFarmerId(stop.farmer);
                  setSelectedFarmId(stop.farm ?? null);
                } else {
                  setSelectedRouteId(r.id);
                  setSelectedRouteStopId(null);
                }
              } else {
                setSelectedRouteId(r.id);
                setSelectedRouteStopId(null);
              }
              return;
            }
            const monday = new Date();
            const day = monday.getDay();
            const diff = (day + 6) % 7;
            monday.setDate(monday.getDate() - diff);
            const weekStart = monday.toISOString().slice(0, 10);
            const list = await api.getRoutes({ week_start: weekStart });
            if (cancelled) return;
            const today = new Date().toISOString().slice(0, 10);
            const routeListForToday = (list ?? []).filter((rt) => rt.scheduled_date === today);
            setTodayRoutes(routeListForToday);
            setTodayRoute(routeListForToday[0] ?? null);
          } catch {
            if (!cancelled) {
              setTodayRoutes([]);
              setTodayRoute(null);
            }
          }
        })();
      })();
      return () => { cancelled = true; };
    }, [params.farmerId, params.routeId, params.routeStopId, userId, applyOptions])
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
        setSelectedRouteId(null);
        setSelectedRouteStopId(null);
        setRecordingWithoutPlan(false);
        setSelectedFarmerId(s.farmer ?? null);
        setSelectedFarmId(s.farm ?? null);
      }
    }
  }, [params.scheduleId, plannedSchedules]);

  /** Single route for today with no planned stops: route is already chosen; user only picks farmer/stockist (or ad-hoc from here). */
  useEffect(() => {
    const routeIdParam =
      typeof params.routeId === 'string'
        ? params.routeId
        : Array.isArray(params.routeId)
          ? params.routeId[0]
          : undefined;
    if (routeIdParam) return;
    if (selectedScheduleId) return;
    if (recordingWithoutPlan) return;
    if (todayRoutes.length !== 1) return;
    const r = todayRoutes[0];
    if ((r.stops?.length ?? 0) > 0) return;
    setTodayRoute(r);
    setSelectedRouteId((prev) => prev ?? r.id);
  }, [todayRoutes, params.routeId, selectedScheduleId, recordingWithoutPlan]);

  const selectedSchedule = plannedSchedules.find((s) => s.id === selectedScheduleId);
  const scheduleLockedForFarm = !!selectedScheduleId && selectedSchedule?.status === 'accepted' && !!selectedSchedule?.farm;

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
        const list = rows.map(farmRowToFarm);
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

  /** User must pick either a planned (accepted) schedule or today’s weekly route when either exists. */
  const hasWeeklyRouteToday = todayRoutes.length > 0;
  const requiresPlanChoice = acceptedSchedules.length > 0 || hasWeeklyRouteToday;
  const mustSelectSchedule =
    !recordingWithoutPlan &&
    requiresPlanChoice &&
    (!selectedScheduleId || (selectedSchedule != null && selectedSchedule.status !== 'accepted')) &&
    !selectedRouteId;
  const scheduleIdForSubmit = selectedScheduleId ?? undefined;
  const routeIdForSubmit = selectedRouteId ?? undefined;

  const submit = useCallback(async (opts?: { skipStep3?: boolean }) => {
    const validation = validateRecordVisit({
      scheduleIdForSubmit,
      routeIdForSubmit,
      mustSelectSchedule,
      acceptedSchedulesLength: acceptedSchedules.length,
      hasWeeklyRouteToday,
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
      skipStep3: opts?.skipStep3,
    });
    if (!validation.valid) {
      setError(validation.error ?? 'Please fix the errors below.');
      return;
    }
    if (!selectedFarmerId || !location) return;
    setSubmitting(true);
    setError('');
    try {
      const photoPlaceName = selectedFarm?.village ?? selectedFarmer?.display_name ?? 'Visit location';
      const step3Payload = buildStep3Payload(step3Values, visitFormFieldSchema);
      const productLinesPayload = productLines.length > 0
        ? productLines.map((p) => ({
          product_id: p.product_id,
          quantity_sold: parseFloat(p.quantity_sold) || 0,
        }))
        : undefined;

      try {
        await api.createVisit({
          farmer_id: selectedFarmerId,
          farm_id: selectedFarmId || undefined,
          schedule_id: scheduleIdForSubmit,
          route_id: routeIdForSubmit,
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
          product_lines: productLinesPayload,
        });
        if (scheduleIdForSubmit) {
          setScheduleIdsWithRecordedVisits((prev) => new Set(prev).add(scheduleIdForSubmit));
        }
        setDialogSuccess(true);
        setDialogVisible(true);
        return;
      } catch (apiError) {
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
      }

      await enqueueVisit({
        farmer_id: selectedFarmerId,
        farm_id: selectedFarmId || undefined,
        schedule_id: scheduleIdForSubmit,
        route_id: routeIdForSubmit,
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
        product_lines: productLinesPayload,
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
  }, [scheduleIdForSubmit, routeIdForSubmit, mustSelectSchedule, acceptedSchedules.length, selectedFarmerId, selectedFarmId, location, photoUris, photoTakenAts, step3Fields, step3Values, visitFormFieldSchema, activityTypes, activityTypesList, notes, distanceM, maxM, labels.partner, router, productLines, selectedFarm, selectedFarmer]);

  const activityLabel = useMemo(() => {
    if (activityTypes.length === 0) return 'Select activities';
    const parts = activityTypes.map(
      (v) =>
        activityTypesList.find((a) => a.value === v)?.label ??
        ACTIVITY_TYPES.find((a) => a.value === v)?.label ??
        v
    );
    return parts.join(', ');
  }, [activityTypes, activityTypesList]);

  const canOpenExtraStep =
    !mustSelectSchedule &&
    photoUris.length > 0 &&
    !!location &&
    (distanceM === null || gpsValid) &&
    !!selectedFarmerId;

  const pickRouteStop = useCallback((stop: RouteStop) => {
    const route = todayRoute;
    if (!route) return;
    setRecordingWithoutPlan(false);
    setSelectedRouteStopId(stop.id);
    setSelectedRouteId(route.id);
    setSelectedScheduleId(null);
    setSelectedFarmerId(stop.farmer);
    setSelectedFarmId(stop.farm ?? null);
  }, [todayRoute]);

  const pickTodayRoute = useCallback((route: Route) => {
    setRecordingWithoutPlan(false);
    setTodayRoute(route);
    setSelectedRouteId(route.id);
    setSelectedRouteStopId(null);
    setSelectedScheduleId(null);
    setSelectedFarmerId(null);
    setSelectedFarmId(null);
  }, []);

  const openFarmerPicker = useCallback(() => {
    setFarmerModalTitle(null);
    setFarmerModalOpen(true);
  }, []);

  const closeFarmerModal = useCallback(() => {
    setFarmerModalTitle(null);
    setFarmerModalOpen(false);
  }, []);

  const adHocRouteCustomer = useCallback(async () => {
    const route = todayRoute;
    if (!route) return;
    await refreshLocation();
    setRecordingWithoutPlan(false);
    setSelectedRouteStopId(null);
    setSelectedRouteId(route.id);
    setSelectedScheduleId(null);
    setSelectedFarmerId(null);
    setSelectedFarmId(null);
    setFarmerModalTitle('Choose farmer or stockist');
    setFarmerModalOpen(true);
  }, [todayRoute, refreshLocation]);

  const pickSchedule = useCallback((s: Schedule) => {
    setRecordingWithoutPlan(false);
    setSelectedScheduleId(s.id);
    setSelectedRouteId(null);
    setSelectedRouteStopId(null);
    if (s.farmer) setSelectedFarmerId(s.farmer);
    setSelectedFarmId(s.farm ?? null);
  }, []);

  const fieldVisitNotFromList = useCallback(() => {
    setRecordingWithoutPlan(true);
    setSelectedScheduleId(null);
    setSelectedRouteId(null);
    setSelectedRouteStopId(null);
    setSelectedFarmerId(null);
    setSelectedFarmId(null);
    setFarmerModalTitle(null);
    setFarmerModalOpen(true);
  }, []);

  const selectFarmerAndClose = useCallback((id: string | null) => {
    setSelectedFarmerId(id);
    setFarmerModalTitle(null);
    setFarmerModalOpen(false);
    if (!id) setSelectedFarmId(null);
  }, []);

  const removePhotoAt = useCallback((index: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
    setPhotoTakenAts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const dismissDialog = useCallback(() => {
    setDialogVisible(false);
    setSubmitError('');
    router.back();
  }, [router]);

  return {
    permission,
    requestPermission,
    router,
    isOnline,
    step,
    setStep,
    snackbarMsg,
    setSnackbarMsg,
    dialogVisible,
    dialogSuccess,
    submitError,
    dismissDialog,
    distanceM,
    cameraModalVisible,
    setCameraModalVisible,
    cameraRef,
    takePhoto,
    openCameraModal,
    refreshLocation,
    submit,
    labels,
    products,
    visitFormFieldSchema,
    todayRoute,
    todayRoutes,
    acceptedSchedules,
    farmers,
    selectedRouteStopId,
    selectedRouteId,
    selectedScheduleId,
    selectedFarmerId,
    selectedFarmId,
    setSelectedFarmId,
    mustSelectSchedule,
    scheduleLockedForFarm,
    selectedFarmer,
    selectedFarm,
    farms,
    farmerModalOpen,
    setFarmerModalOpen,
    farmerModalTitle,
    openFarmerPicker,
    closeFarmerModal,
    farmModalOpen,
    setFarmModalOpen,
    activityTypesModalOpen,
    setActivityTypesModalOpen,
    activityTypesOptionsRefreshing,
    activityTypeOptions,
    activityTypes,
    setActivityTypes,
    activityLabel,
    location,
    locationError,
    locationLoading,
    gpsValid,
    maxM,
    photoUris,
    submitting,
    pickRouteStop,
    pickTodayRoute,
    adHocRouteCustomer,
    pickSchedule,
    fieldVisitNotFromList,
    selectFarmerAndClose,
    removePhotoAt,
    step3Fields,
    step3Values,
    setStep3Values,
    productLines,
    setProductLines,
    productModalOpen,
    setProductModalOpen,
    productModalFieldKey,
    setProductModalFieldKey,
    error,
    canOpenExtraStep,
  };
}
