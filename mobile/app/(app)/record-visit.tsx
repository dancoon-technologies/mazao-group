import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Button,
  Text,
  ActivityIndicator,
  TextInput,
  Menu,
  Divider,
} from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { api, type Farmer, type Farm } from '@/lib/api';
import { ACTIVITY_TYPES, DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';

export default function RecordVisitScreen() {
  const router = useRouter();
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
  const [activityMenuOpen, setActivityMenuOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [cropStage, setCropStage] = useState('');
  const [germinationPercent, setGerminationPercent] = useState('');
  const [survivalRate, setSurvivalRate] = useState('');
  const [pestsDiseases, setPestsDiseases] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [harvestKgs, setHarvestKgs] = useState('');
  const [farmersFeedback, setFarmersFeedback] = useState('');
  const cameraRef = useRef<CameraView>(null);

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
        setLocationError('Location permission is required to verify visit.');
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
    return () => {
      cancelled = true;
    };
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !permission?.granted) {
      if (!permission?.granted) requestPermission();
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to take photo');
    }
  }, [permission?.granted, requestPermission]);

  const submit = useCallback(async () => {
    if (!selectedFarmerId) {
      setError('Select a farmer.');
      return;
    }
    if (!photoUri) {
      setError('Take a photo as proof of visit.');
      return;
    }
    if (!location) {
      setError('Location is required.');
      return;
    }
    setSubmitting(true);
    setError('');
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
        survival_rate: survivalRate || undefined,
        pests_diseases: pestsDiseases || undefined,
        order_value: orderValue ? parseFloat(orderValue) : undefined,
        harvest_kgs: harvestKgs ? parseFloat(harvestKgs) : undefined,
        farmers_feedback: farmersFeedback || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit visit');
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedFarmerId,
    selectedFarmId,
    photoUri,
    location,
    activityType,
    notes,
    cropStage,
    germinationPercent,
    survivalRate,
    pestsDiseases,
    orderValue,
    harvestKgs,
    farmersFeedback,
    router,
  ]);

  const activityLabel = ACTIVITY_TYPES.find((a) => a.value === activityType)?.label ?? activityType;

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyLarge" style={styles.message}>
          Camera access is required to record visit proof.
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.button}>
          Allow camera
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Farmer selection */}
        <View style={styles.section}>
          <Text variant="labelLarge">Farmer *</Text>
          {farmers.length === 0 && !params.farmerId ? (
            <Text variant="bodySmall" style={styles.hint}>
              No farmers assigned. Add a farmer first.
            </Text>
          ) : (
            farmers.map((f) => (
              <Button
                key={f.id}
                mode={selectedFarmerId === f.id ? 'contained' : 'outlined'}
                onPress={() => setSelectedFarmerId(f.id)}
                style={styles.farmerBtn}
              >
                {f.display_name}
              </Button>
            ))
          )}
        </View>

        {/* Optional farm */}
        {selectedFarmerId && farms.length > 0 && (
          <View style={styles.section}>
            <Text variant="labelLarge">Farm (optional)</Text>
            <Button
              mode={selectedFarmId === null ? 'contained' : 'outlined'}
              onPress={() => setSelectedFarmId(null)}
              style={styles.farmerBtn}
            >
              No specific farm
            </Button>
            {farms.map((farm) => (
              <Button
                key={farm.id}
                mode={selectedFarmId === farm.id ? 'contained' : 'outlined'}
                onPress={() => setSelectedFarmId(farm.id)}
                style={styles.farmerBtn}
              >
                {farm.village} {farm.county ? `— ${farm.county}` : ''}
              </Button>
            ))}
          </View>
        )}

        {/* Activity type */}
        <View style={styles.section}>
          <Text variant="labelLarge">Activity type</Text>
          <Menu
            visible={activityMenuOpen}
            onDismiss={() => setActivityMenuOpen(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setActivityMenuOpen(true)}
                style={styles.menuAnchor}
              >
                {activityLabel}
              </Button>
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
        </View>

        {/* Location */}
        {locationError ? (
          <Text style={styles.error}>{locationError}</Text>
        ) : location ? (
          <Text variant="bodySmall" style={styles.coords}>
            Location: {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
          </Text>
        ) : (
          <ActivityIndicator size="small" style={styles.locationLoad} />
        )}

        {/* Camera */}
        <View style={styles.cameraWrap}>
          {photoUri ? (
            <View style={styles.preview}>
              <Image source={{ uri: photoUri }} style={styles.previewImg} />
              <Button mode="outlined" onPress={() => setPhotoUri(null)}>
                Retake photo
              </Button>
            </View>
          ) : (
            <CameraView style={styles.camera} ref={cameraRef}>
              <View style={styles.cameraActions}>
                <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} />
              </View>
            </CameraView>
          )}
        </View>

        {/* Notes */}
        <TextInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          multiline
          numberOfLines={2}
          style={styles.input}
        />

        {/* Optional report fields */}
        <Text variant="labelMedium" style={styles.optionalSection}>
          Optional report fields
        </Text>
        <TextInput label="Crop stage" value={cropStage} onChangeText={setCropStage} mode="outlined" style={styles.input} />
        <TextInput
          label="Germination %"
          value={germinationPercent}
          onChangeText={setGerminationPercent}
          keyboardType="decimal-pad"
          mode="outlined"
          style={styles.input}
        />
        <TextInput label="Survival rate" value={survivalRate} onChangeText={setSurvivalRate} mode="outlined" style={styles.input} />
        <TextInput label="Pests / diseases" value={pestsDiseases} onChangeText={setPestsDiseases} mode="outlined" style={styles.input} />
        <TextInput
          label="Order value"
          value={orderValue}
          onChangeText={setOrderValue}
          keyboardType="decimal-pad"
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Harvest (kgs)"
          value={harvestKgs}
          onChangeText={setHarvestKgs}
          keyboardType="decimal-pad"
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Farmer feedback"
          value={farmersFeedback}
          onChangeText={setFarmersFeedback}
          mode="outlined"
          multiline
          numberOfLines={2}
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={submit}
            loading={submitting}
            disabled={!selectedFarmerId || !photoUri || !location || submitting}
          >
            Submit visit
          </Button>
          <Button mode="text" onPress={() => router.back()}>
            Cancel
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: { textAlign: 'center', marginBottom: 16 },
  button: { marginTop: 8 },
  section: { marginBottom: 16 },
  hint: { marginTop: 4, opacity: 0.8 },
  farmerBtn: { marginTop: 4 },
  menuAnchor: { alignSelf: 'flex-start' },
  coords: { marginBottom: 8, opacity: 0.8 },
  locationLoad: { marginVertical: 8 },
  cameraWrap: {
    minHeight: 280,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 16,
  },
  camera: { flex: 1, minHeight: 260 },
  cameraActions: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 4,
    borderColor: '#2e7d32',
  },
  preview: {
    minHeight: 260,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImg: { width: '100%', height: 240, resizeMode: 'contain' },
  input: { marginBottom: 8 },
  optionalSection: { marginTop: 8, marginBottom: 4 },
  error: { color: '#b00020', marginVertical: 8 },
  actions: { gap: 8, marginTop: 16 },
});
