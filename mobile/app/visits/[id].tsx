import { database } from '@/database';
import { createOrUpdate } from '@/database/helpers';
import SyncQueue from '@/database/models/SyncQueue';
import Visit from '@/database/models/Visit';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Card, Snackbar, Text } from 'react-native-paper';

interface Schedule {
  id: string;
  farmer_display_name: string;
}

export default function RecordVisitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(params.id ?? null);

  const cameraRef = useRef<CameraView>(null);

  // Load schedules (if no id passed)
  useEffect(() => {
    if (!params.id) {
      (async () => {
        try {
          const res = await fetch('https://api.example.com/schedules');
          const data: Schedule[] = await res.json();
          setSchedules(data);
        } catch {
          setSchedules([]);
        }
      })();
    } else {
      setSelectedScheduleId(params.id);
    }
  }, [params]);

  // Get location once
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
      } catch (e) {
        if (!cancelled) setLocationError('Could not get location.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Take photo
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

  // Submit visit offline-first
  const submitVisit = useCallback(async () => {
    if (!selectedScheduleId) return setError('Select a schedule.');
    if (!photoUri) return setError('Take a photo as proof.');
    if (!location) return setError('Location is required.');

    setSubmitting(true);
    setError('');

    try {
      const id = crypto.randomUUID();

      // Save visit locally
      await createOrUpdate('visits', {
        id,
        officer: 'current-officer-id', // replace with auth
        schedule_id: selectedScheduleId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        photo: photoUri,
        updated_at: Date.now(),
        is_deleted: false,
      }, Visit);

      // Add to sync queue
      await database.action(async () => {
        const queue = database.get('sync_queue').prepareCreate((r) => {
          const item = r as SyncQueue;
          item.entity = 'visit';
          item.payload = JSON.stringify({
            id,
            officer: 'current-officer-id',
            schedule_id: selectedScheduleId,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            photo: photoUri,
            updated_at: Date.now(),
            is_deleted: false,
          });
          item.operation = 'CREATE';
          item.status = 'pending';
          item.timestamp = Date.now();
        });
      });

      setSnackbar('Visit recorded locally! It will sync when online.');
      // Reset form
      setPhotoUri(null);
      setSelectedScheduleId(null);
      setLocation(null);

      // Optionally trigger sync
      // await syncWithServer();

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save visit.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedScheduleId, photoUri, location]);

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
    <ScrollView style={styles.container}>
      {/* Schedule selection */}
      {!params.id && schedules.length > 0 && (
        <View style={styles.section}>
          <Text variant="labelLarge">Select schedule</Text>
          {schedules.map(s => (
            <Card key={s.id} style={styles.card} onPress={() => setSelectedScheduleId(s.id)}>
              <Card.Content>
                <Text variant="bodyMedium">{s.farmer_display_name}</Text>
              </Card.Content>
              {selectedScheduleId === s.id && <Text style={styles.selected}>Selected</Text>}
            </Card>
          ))}
        </View>
      )}

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
            <Button mode="outlined" onPress={() => setPhotoUri(null)}>Retake photo</Button>
          </View>
        ) : (
          <CameraView style={styles.camera} ref={cameraRef}>
            <View style={styles.cameraActions}>
              <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} />
            </View>
          </CameraView>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Actions */}
      <View style={styles.actions}>
        <Button mode="contained" onPress={submitVisit} loading={submitting} disabled={submitting}>
          Submit visit
        </Button>
        <Button mode="text" onPress={() => router.back()}>Cancel</Button>
      </View>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={3000}>
        {snackbar}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { textAlign: 'center', marginBottom: 16 },
  button: { marginTop: 8 },
  section: { marginBottom: 16 },
  card: { marginTop: 4 },
  selected: { color: '#2e7d32', fontWeight: 'bold' },
  coords: { marginBottom: 8, opacity: 0.8 },
  locationLoad: { marginVertical: 8 },
  cameraWrap: { height: 300, borderRadius: 12, overflow: 'hidden', marginVertical: 16 },
  camera: { flex: 1 },
  cameraActions: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 24 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 4, borderColor: '#2e7d32' },
  preview: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  previewImg: { width: '100%', flex: 1, resizeMode: 'contain' },
  error: { color: '#b00020', marginVertical: 8 },
  actions: { gap: 8, marginVertical: 8 },
});