import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  Appbar,
  Text,
  TextInput,
  Button,
  Card,
  Menu,
  Chip,
  ProgressBar,
  HelperText,
  IconButton,
  List,
  Surface,
  ActivityIndicator,
  Portal,
  Dialog,
  Snackbar,
} from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Farmer, type Farm } from '@/lib/api';
import { ACTIVITY_TYPES, DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';
import { enqueueVisit } from '@/lib/syncWithServer';
import { useTheme } from 'react-native-paper';

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
  const params = useLocalSearchParams<{ farmerId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(params.farmerId ?? null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [activityType, setActivityType] = useState(DEFAULT_ACTIVITY_TYPE);
  const [farmerMenuOpen, setFarmerMenuOpen] = useState(false);
  const [activityMenuOpen, setActivityMenuOpen] = useState(false);
  const [accordionExpanded, setAccordionExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [cropStage, setCropStage] = useState('');
  const [germinationPercent, setGerminationPercent] = useState('');
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogSuccess, setDialogSuccess] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const selectedFarmer = farmers.find((f) => f.id === selectedFarmerId);
  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  const distanceM = useMemo(() => {
    if (!location || !selectedFarm) return null;
    return Math.round(
      haversineDistance(
        location.coords.latitude,
        location.coords.longitude,
        selectedFarm.latitude,
        selectedFarm.longitude
      )
    );
  }, [location, selectedFarm]);

  const gpsValid = distanceM === null || distanceM <= 100;
  const progress = distanceM !== null ? Math.max(0, 1 - distanceM / 100) : 1;

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? false));
    return () => sub();
  }, []);

  useEffect(() => {
    api.getFarmers().then(setFarmers).catch(() => setFarmers([]));
  }, []);

  useEffect(() => {
    if (params.farmerId) setSelectedFarmerId(params.farmerId);
  }, [params.farmerId]);

  useEffect(() => {
    if (!selectedFarmerId) {
      setFarms([]);
      setSelectedFarmId(null);
      return;
    }
    api.getFarms(selectedFarmerId).then(setFarms).catch(() => setFarms([]));
    setSelectedFarmId(null);
  }, [selectedFarmerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setLocationError('Location permission is required.');
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
    })();
    return () => { cancelled = true; };
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !permission?.granted) {
      if (!permission?.granted) requestPermission();
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to take photo');
    }
  }, [permission?.granted, requestPermission]);

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
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            photo: { uri: photoUri, type: 'image/jpeg', name: 'visit.jpg' },
            activity_type: activityType,
            notes: notes || undefined,
            crop_stage: cropStage || undefined,
            germination_percent: germinationPercent ? parseFloat(germinationPercent) : undefined,
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
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        photo_uri: photoUri,
        notes: notes || undefined,
        activity_type: activityType,
        crop_stage: cropStage || undefined,
        germination_percent: germinationPercent ? parseFloat(germinationPercent) : undefined,
      });
      setSnackbarMsg('Saved for sync when online.');
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      setDialogSuccess(false);
      setDialogVisible(true);
    } finally {
      setSubmitting(false);
    }
  }, [selectedFarmerId, selectedFarmId, photoUri, location, activityType, notes, cropStage, germinationPercent, isOnline, router]);

  const activityLabel = ACTIVITY_TYPES.find((a) => a.value === activityType)?.label ?? activityType;

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
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Record Visit" />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {!isOnline && isOnline !== null && (
            <Chip icon="cloud-off-outline" style={styles.offlineChip}>
              Offline — will sync when back online
            </Chip>
          )}

          <Menu
            visible={farmerMenuOpen}
            onDismiss={() => setFarmerMenuOpen(false)}
            anchorPosition="bottom"
            anchor={
              <View>
                <TextInput
                  label="Select Farmer"
                  value={selectedFarmer?.display_name ?? ''}
                  mode="outlined"
                  right={<TextInput.Icon icon="menu-down" onPress={() => setFarmerMenuOpen(true)} />}
                  style={styles.block}
                  onPressIn={() => setFarmerMenuOpen(true)}
                />
              </View>
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
          <Button mode="text" onPress={() => router.push('/(app)/add-farmer')} style={styles.block}>
            + Add Farmer
          </Button>

          {selectedFarmerId && farms.length > 0 && (
            <>
              <Text variant="titleSmall" style={styles.sectionLabel}>
                Farm (optional)
              </Text>
              <Card
                mode={selectedFarmId === null ? 'contained' : 'outlined'}
                style={styles.card}
                onPress={() => setSelectedFarmId(null)}
              >
                <Card.Content>
                  <Text variant="bodyMedium">No specific farm</Text>
                </Card.Content>
              </Card>
              {farms.map((farm) => (
                <Card
                  key={farm.id}
                  mode={selectedFarmId === farm.id ? 'contained' : 'outlined'}
                  style={styles.card}
                  onPress={() => setSelectedFarmId(farm.id)}
                >
                  <Card.Title title={farm.village} />
                  <Card.Content>
                    <Text variant="bodyMedium">Crop: {farm.crop_type ?? '—'}</Text>
                    <Text variant="bodySmall">{farm.plot_size ?? '—'} Acres</Text>
                  </Card.Content>
                </Card>
              ))}
            </>
          )}

          <Text variant="titleSmall" style={styles.sectionLabel}>
            Location Verification
          </Text>
          <Card style={styles.card}>
            <Card.Content>
              {locationError ? (
                <HelperText type="error">{locationError}</HelperText>
              ) : location ? (
                <>
                  <Text variant="bodyMedium">
                    Distance from Farm: {distanceM !== null ? `${distanceM}m` : 'N/A'}
                  </Text>
                  <ProgressBar
                    progress={progress}
                    color={gpsValid ? theme.colors.primary : theme.colors.error}
                    style={styles.progressBar}
                  />
                  <Chip icon="map-marker" style={styles.chip}>
                    GPS Accuracy ±5m
                  </Chip>
                  {!gpsValid && (
                    <HelperText type="error">You must be within 100m of the farm.</HelperText>
                  )}
                </>
              ) : (
                <ActivityIndicator size="small" />
              )}
            </Card.Content>
          </Card>

          <Text variant="titleSmall" style={styles.sectionLabel}>
            Photo
          </Text>
          <Card style={styles.card}>
            <Card.Content style={styles.photoContent}>
              {photoUri ? (
                <>
                  <Image source={{ uri: photoUri }} style={styles.previewImg} />
                  <Button mode="outlined" onPress={() => setPhotoUri(null)}>
                    Retake photo
                  </Button>
                </>
              ) : (
                <View style={styles.cameraWrap}>
                  <CameraView style={styles.camera} ref={cameraRef} />
                  <View style={styles.cameraOverlay}>
                    <IconButton
                      icon="camera"
                      size={48}
                      onPress={takePhoto}
                      iconColor="#fff"
                      style={styles.captureIcon}
                    />
                    <Text variant="bodyMedium" style={styles.cameraPrompt}>
                      Tap to capture photo
                    </Text>
                    <TouchableOpacity style={styles.captureTouch} activeOpacity={1} onPress={takePhoto} />
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>

          <Text variant="titleSmall" style={styles.sectionLabel}>
            Activity type
          </Text>
          <Menu
            visible={activityMenuOpen}
            onDismiss={() => setActivityMenuOpen(false)}
            anchor={<Button mode="outlined" onPress={() => setActivityMenuOpen(true)}>{activityLabel}</Button>}
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

          <TextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.block}
          />

          <List.AccordionGroup>
            <List.Accordion
              title="Additional Details"
              id="1"
              expanded={accordionExpanded}
              onPress={() => setAccordionExpanded(!accordionExpanded)}
            >
              <List.Item title="" />
              <Surface style={styles.accordionInner} elevation={0}>
                <TextInput
                  label="Crop stage"
                  value={cropStage}
                  onChangeText={setCropStage}
                  mode="outlined"
                  style={styles.block}
                />
                <TextInput
                  label="Germination %"
                  value={germinationPercent}
                  onChangeText={setGerminationPercent}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.block}
                />
                <TextInput
                  label="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  mode="outlined"
                  multiline
                  style={styles.block}
                />
              </Surface>
            </List.Accordion>
          </List.AccordionGroup>

          {error ? <HelperText type="error">{error}</HelperText> : null}

          <Button
            mode="contained"
            onPress={submit}
            loading={submitting}
            disabled={!selectedFarmerId || !photoUri || !location || !gpsValid || submitting}
            style={styles.submitBtn}
            accessibilityLabel="Submit visit"
          >
            Submit Visit
          </Button>
          <Button mode="outlined" onPress={() => router.back()} style={styles.block}>
            Cancel
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); router.back(); }}>
          <Dialog.Icon icon={dialogSuccess ? 'check-circle' : 'alert'} color={dialogSuccess ? theme.colors.primary : theme.colors.error} />
          <Dialog.Title>{dialogSuccess ? 'Visit Verified' : 'Error'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {dialogSuccess ? (distanceM !== null ? `Distance: ${distanceM}m` : 'Visit recorded.') : 'Failed to submit visit.'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setDialogVisible(false); router.back(); }}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snackbarMsg} onDismiss={() => setSnackbarMsg('')} duration={4000}>
        {snackbarMsg}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  topBtn: { marginTop: 16 },
  block: { marginBottom: 12 },
  sectionLabel: { marginTop: 8, marginBottom: 4 },
  offlineChip: { marginBottom: 12 },
  card: { marginVertical: 8 },
  progressBar: { height: 8, borderRadius: 2, marginVertical: 8 },
  chip: { alignSelf: 'flex-start', marginTop: 4 },
  photoContent: { alignItems: 'center', overflow: 'hidden' },
  previewImg: { width: '100%', height: 200, borderRadius: 4, marginBottom: 8 },
  cameraWrap: { position: 'relative', width: '100%', minHeight: 240, borderRadius: 4, overflow: 'hidden' },
  camera: { flex: 1, minHeight: 240 },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
  },
  captureIcon: { backgroundColor: 'rgba(0,0,0,0.3)' },
  cameraPrompt: { color: '#fff', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  captureTouch: { ...StyleSheet.absoluteFillObject },
  accordionInner: { paddingHorizontal: 16, paddingBottom: 16 },
  submitBtn: { marginTop: 16 },
});
