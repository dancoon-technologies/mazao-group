import {
  getFarmers as getFarmersDb,
  getFarms as getFarmsDb,
  getPlannedSchedules as getPlannedSchedulesDb,
} from '@/database/sqlite';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Farm, type Farmer, type Schedule, type VisitSettings } from '@/lib/api';
import { ACTIVITY_TYPES, DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';
import { enqueueVisit, syncWithServer } from '@/lib/syncWithServer';
import NetInfo from '@react-native-community/netinfo';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

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

export default function RecordVisitScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { userId } = useAuth();
  const params = useLocalSearchParams<{ farmerId?: string; scheduleId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [plannedSchedules, setPlannedSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(params.scheduleId ?? null);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(params.farmerId ?? null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [activityType, setActivityType] = useState(DEFAULT_ACTIVITY_TYPE);
  const [farmerMenuOpen, setFarmerMenuOpen] = useState(false);
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
    api.getOptions().then((o) => setVisitSettings(o.visit_settings)).catch(() => setVisitSettings(null));
  }, []);

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

  useEffect(() => {
    if (!userId) {
      setPlannedSchedules([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startTs = startOfToday.getTime();
        const endTs = startTs + 7 * 24 * 60 * 60 * 1000;
        const rows = await getPlannedSchedulesDb(userId, startTs, endTs);
        if (cancelled) return;
        const list: Schedule[] = rows.map((r) => ({
          id: r.id,
          officer: r.officer,
          officer_email: '',
          farmer: r.farmer ?? null,
          farmer_display_name: null,
          scheduled_date: new Date(r.scheduled_date).toISOString().slice(0, 10),
          notes: r.notes ?? '',
          status: r.status as 'proposed' | 'accepted' | 'rejected',
          created_at: undefined,
        }));
        setPlannedSchedules(list);
      } catch {
        if (!cancelled) setPlannedSchedules([]);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (params.scheduleId && plannedSchedules.length > 0) {
      const s = plannedSchedules.find((s) => s.id === params.scheduleId);
      if (s?.farmer) {
        setSelectedScheduleId(s.id);
        setSelectedFarmerId(s.farmer);
      }
    }
  }, [params.scheduleId, plannedSchedules]);

  useEffect(() => {
    if (!selectedFarmerId) {
      setFarms([]);
      setSelectedFarmId(null);
      return;
    }
    let cancelled = false;
    setSelectedFarmId(null);
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
      } catch {
        if (!cancelled) setFarms([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedFarmerId]);

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
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setCameraModalVisible(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to take photo');
    }
  }, [permission?.granted]);

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

  const submit = useCallback(async () => {
    if (!selectedFarmerId || !photoUri || !location) {
      setError('Select farmer, capture photo, and ensure location is available.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (isOnline === true) {
        try {
          await api.createVisit({
            farmer_id: selectedFarmerId,
            farm_id: selectedFarmId || undefined,
            schedule_id: selectedScheduleId || undefined,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            photo: { uri: photoUri, type: 'image/jpeg', name: 'visit.jpg' },
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
          setDialogSuccess(true);
          setDialogVisible(true);
          return;
        } catch {
          setSnackbarMsg('Upload failed. Saving for sync when online.');
        }
      }
      await enqueueVisit({
        farmer_id: selectedFarmerId,
        farm_id: selectedFarmId || undefined,
        schedule_id: selectedScheduleId || undefined,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        photo_uri: photoUri,
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
      setSnackbarMsg('Saved for sync when online.');
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit visit.');
      setDialogSuccess(false);
      setDialogVisible(true);
    } finally {
      setSubmitting(false);
    }
  }, [selectedFarmerId, selectedFarmId, selectedScheduleId, photoUri, location, activityType, notes, cropStage, germinationPercent, survivalRatePercent, orderValue, harvestKgs, pestsDiseases, farmersFeedback, isOnline, router]);

  const activityLabel = ACTIVITY_TYPES.find((a) => a.value === activityType)?.label ?? activityType;
  const scheduleLocked = !!selectedScheduleId;

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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {!isOnline && isOnline !== null && (
            <Chip icon="cloud-off-outline" style={styles.offlineChip} compact>
              Offline — will sync when back online
            </Chip>
          )}

          {plannedSchedules.length > 0 && (
            <Surface style={styles.section} elevation={0}>
              <Text variant="labelLarge" style={styles.fieldLabel}>Link to planned visit (optional)</Text>
              <Text variant="bodySmall" style={styles.hint}>
                Selecting a schedule links this visit to that planned visit. Farmer and farm are then fixed for this visit.
              </Text>
              <View style={styles.scheduleChips}>
                <Chip
                  selected={selectedScheduleId === null}
                  onPress={() => {
                    setSelectedScheduleId(null);
                  }}
                  style={styles.scheduleChip}
                  compact
                >
                  None
                </Chip>
                {plannedSchedules.map((s) => {
                  const farmerName = farmers.find((f) => f.id === s.farmer)?.display_name ?? s.farmer ?? '—';
                  const dateStr = s.scheduled_date;
                  return (
                    <Chip
                      key={s.id}
                      selected={selectedScheduleId === s.id}
                      onPress={() => {
                        setSelectedScheduleId(s.id);
                        if (s.farmer) setSelectedFarmerId(s.farmer);
                      }}
                      style={styles.scheduleChip}
                      compact
                    >
                      {dateStr} — {farmerName}
                    </Chip>
                  );
                })}
              </View>
            </Surface>
          )}

          <Surface style={styles.section} elevation={0}>
            <Text variant="labelLarge" style={styles.fieldLabel}>Farmer *</Text>
            {farmers.length === 0 ? (
              <Text variant="bodyMedium" style={styles.hint}>
                No farmers yet. Add a farmer first, then record visits.
              </Text>
            ) : scheduleLocked ? (
              <>
                <TextInput
                  placeholder="Select farmer"
                  value={selectedFarmer?.display_name ?? ''}
                  mode="outlined"
                  editable={false}
                  style={styles.input}
                />
                <HelperText type="info" style={styles.lockedHint}>Set by selected planned visit. Change schedule above to change farmer.</HelperText>
              </>
            ) : (
              <>
                <Menu
                  visible={farmerMenuOpen}
                  onDismiss={() => setFarmerMenuOpen(false)}
                  anchorPosition="bottom"
                  anchor={
                    <TextInput
                      placeholder="Select farmer"
                      value={selectedFarmer?.display_name ?? ''}
                      mode="outlined"
                      right={<TextInput.Icon icon="menu-down" onPress={() => setFarmerMenuOpen(true)} />}
                      style={styles.input}
                      onPressIn={() => setFarmerMenuOpen(true)}
                      editable={false}
                    />
                  }
                >
                  {farmers.map((f) => (
                    <Menu.Item
                      key={f.id}
                      onPress={() => {
                        setSelectedFarmerId(f.id);
                        setFarmerMenuOpen(false);
                      }}
                      title={f.display_name}
                    />
                  ))}
                </Menu>
                <Button
                  mode="text"
                  icon="account-plus"
                  onPress={() => router.push('/(app)/add-farmer')}
                  style={styles.addFarmerBtn}
                  compact
                >
                  Add new farmer
                </Button>
              </>
            )}
            {selectedFarmerId && farms.length > 0 && (
              <>
                <Text variant="labelLarge" style={styles.fieldLabel}>Farm (optional)</Text>
                {scheduleLocked && (
                  <HelperText type="info" style={styles.lockedHint}>Set by selected planned visit. Change schedule above to change farm.</HelperText>
                )}
                <Card
                  mode={selectedFarmId === null ? 'contained' : 'outlined'}
                  style={[styles.farmCard, scheduleLocked && styles.farmCardLocked]}
                  onPress={scheduleLocked ? undefined : () => setSelectedFarmId(null)}
                  disabled={scheduleLocked}
                >
                  <Card.Content>
                    <Text variant="bodyMedium">No specific farm</Text>
                  </Card.Content>
                </Card>
                {farms.map((farm) => (
                  <Card
                    key={farm.id}
                    mode={selectedFarmId === farm.id ? 'contained' : 'outlined'}
                    style={[styles.farmCard, scheduleLocked && styles.farmCardLocked]}
                    onPress={scheduleLocked ? undefined : () => setSelectedFarmId(farm.id)}
                    disabled={scheduleLocked}
                  >
                    <Card.Title title={farm.village} titleVariant="titleSmall" />
                    <Card.Content>
                      <Text variant="bodySmall">Crop: {farm.crop_type ?? '—'} · {farm.plot_size ?? '—'}</Text>
                    </Card.Content>
                  </Card>
                ))}
              </>
            )}
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
              <Button
                mode="outlined"
                icon="camera"
                onPress={openCameraModal}
                style={styles.photoEvidenceBtn}
              >
                Take Photo
              </Button>
            </View>
            {photoUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photoUri }} style={styles.previewImg} />
                <Button mode="text" compact onPress={() => { setPhotoUri(null); openCameraModal(); }}>
                  Retake photo
                </Button>
              </View>
            ) : null}
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
              {ACTIVITY_TYPES.map((a) => (
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

          <List.AccordionGroup>
            <List.Accordion
              title="Additional Details (Optional)"
              id="1"
              expanded={accordionExpanded}
              onPress={() => setAccordionExpanded(!accordionExpanded)}
              style={styles.accordion}
              right={props => <List.Icon {...props} icon={accordionExpanded ? 'chevron-up' : 'chevron-down'} />}
            >
              <Surface style={styles.accordionInner} elevation={0}>
                <View style={styles.twoColRow}>
                  <TextInput
                    label="Crop Stage"
                    value={cropStage}
                    onChangeText={setCropStage}
                    mode="outlined"
                    placeholder="e.g., Flowering"
                    style={styles.inputHalf}
                  />
                  <TextInput
                    label="Germination %"
                    value={germinationPercent}
                    onChangeText={setGerminationPercent}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    placeholder="0-100"
                    style={styles.inputHalf}
                  />
                </View>
                <View style={styles.twoColRow}>
                  <TextInput
                    label="Survival Rate %"
                    value={survivalRatePercent}
                    onChangeText={setSurvivalRatePercent}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    placeholder="0-100"
                    style={styles.inputHalf}
                  />
                  <TextInput
                    label="Order Value"
                    value={orderValue}
                    onChangeText={setOrderValue}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    placeholder="Amount"
                    style={styles.inputHalf}
                  />
                </View>
                <TextInput
                  label="Harvest (kg)"
                  value={harvestKgs}
                  onChangeText={setHarvestKgs}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  placeholder="Harvest in kilograms"
                  style={styles.input}
                />
                <TextInput
                  label="Pests/Diseases"
                  value={pestsDiseases}
                  onChangeText={setPestsDiseases}
                  mode="outlined"
                  placeholder="List any pests or diseases"
                  style={styles.input}
                />
                <TextInput
                  label="Farmer's Feedback"
                  value={farmersFeedback}
                  onChangeText={setFarmersFeedback}
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  placeholder="Farmer's comments or feedback"
                  style={styles.input}
                />
              </Surface>
            </List.Accordion>
          </List.AccordionGroup>

          {error ? (
            <HelperText type="error" style={styles.errorBlock}>{error}</HelperText>
          ) : null}

          <Surface style={styles.actionsSection} elevation={0}>
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

      <Snackbar visible={!!snackbarMsg} onDismiss={() => setSnackbarMsg('')} duration={4000} style={styles.snackbarTop}>
        {snackbarMsg}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  snackbarTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  snackbarGreen: { backgroundColor: colors.primary },
  container: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  topBtn: { marginTop: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: { fontWeight: '600' },
  headerClose: { padding: 8 },
  headerCloseText: { fontSize: 28, lineHeight: 32, opacity: 0.9 },
  offlineChip: { marginBottom: 8 },
  section: { padding: 12, marginBottom: 4, borderRadius: 8 },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    padding: 12,
  },
  locationBoxLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  locationIcon: { margin: 0, marginRight: 12 },
  locationStatus: { opacity: 0.85 },
  locationStatusError: { color: '#b00020' },
  photoEvidenceRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  photoEvidenceBtn: { flex: 1 },
  photoPreviewWrap: { marginTop: 8, alignItems: 'center' },
  sectionTitle: { marginBottom: 6 },
  fieldLabel: { marginTop: 6, marginBottom: 4 },
  hint: { marginTop: 2, opacity: 0.85 },
  input: { marginBottom: 8 },
  inputHalf: { flex: 1, marginBottom: 8 },
  twoColRow: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  addFarmerBtn: { marginTop: -2, marginBottom: 2 },
  farmCard: { marginBottom: 4 },
  farmCardLocked: { opacity: 0.85 },
  lockedHint: { marginTop: 2, marginBottom: 4 },
  scheduleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  scheduleChip: { marginBottom: 0 },
  card: { marginBottom: 8 },
  divider: { marginVertical: 4 },
  progressBar: { height: 6, borderRadius: 2, marginVertical: 4 },
  chip: { alignSelf: 'flex-start', marginTop: 2 },
  locationLoading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationLoadingText: { opacity: 0.8 },
  photoContent: { alignItems: 'center', overflow: 'hidden' },
  previewImg: { width: '100%', height: 200, borderRadius: 8, marginBottom: 8 },
  retakeBtn: { marginTop: 4 },
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
  nextBtn: { marginBottom: 0 },
  submitBtn: { marginBottom: 0 },
});
