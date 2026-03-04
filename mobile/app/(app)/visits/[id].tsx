import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Button, Text, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { api, type Schedule } from '@/lib/api';

export default function RecordVisitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(params.id ?? null);
  const cameraRef = useRef<CameraView>(null);

  const loadSchedules = useCallback(() => {
    api.getSchedules().then(setSchedules).catch(() => setSchedules([]));
  }, []);

  useEffect(() => {
    loadSchedules();
    if (params.id) setSelectedScheduleId(params.id);
  }, [params.id, loadSchedules]);

  useFocusEffect(useCallback(() => {
    loadSchedules();
  }, [loadSchedules]));

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
          accuracy: Location.Accuracy.Balanced,
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
    const scheduleId = selectedScheduleId;
    if (!scheduleId) {
      setError('Select a farmer.');
      return;
    }
    const schedule = schedules.find((s) => s.id === scheduleId);
    const farmerId = schedule?.farmer ?? null;
    if (!farmerId) {
      setError('Selected schedule has no farmer.');
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
        farmer_id: farmerId,
        schedule_id: selectedScheduleId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        photo: { uri: photoUri, type: 'image/jpeg', name: 'visit.jpg' },
      });
      Alert.alert('Success', 'Visit recorded successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit visit');
    } finally {
      setSubmitting(false);
    }
  }, [selectedScheduleId, schedules, photoUri, location, router]);

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

  const selectedSchedule = selectedScheduleId ? schedules.find((s) => s.id === selectedScheduleId) : null;

  return (
    <View style={styles.container}>
      {selectedScheduleId && selectedSchedule && (
        <View style={styles.section}>
          <Text variant="bodySmall" style={styles.hint}>
            Recording visit for planned schedule — {selectedSchedule.farmer_display_name ?? 'Farmer'} (fixed).
          </Text>
        </View>
      )}
      {!params.id && schedules.length > 0 && (
        <View style={styles.section}>
          <Text variant="labelLarge">Select schedule</Text>
          <Text variant="bodySmall" style={styles.hint}>
            Visit will be linked to the selected schedule. Farmer is fixed by the schedule.
          </Text>
          {schedules.map((s) => (
            <Button
              key={s.id}
              mode={selectedScheduleId === s.id ? 'contained' : 'outlined'}
              onPress={() => setSelectedScheduleId(s.id)}
              style={styles.scheduleBtn}>
              {s.farmer_display_name}
            </Button>
          ))}
        </View>
      )}

      {locationError ? (
        <Text style={styles.error}>{locationError}</Text>
      ) : location ? (
        <Text variant="bodySmall" style={styles.coords}>
          Location: {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
        </Text>
      ) : (
        <ActivityIndicator size="small" style={styles.locationLoad} />
      )}

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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={submit}
          loading={submitting}
          disabled={
            !selectedScheduleId ||
            !photoUri ||
            !location ||
            (selectedScheduleId !== null && !schedules.find((s) => s.id === selectedScheduleId))
          }>
          Submit visit proof
        </Button>
        <Button mode="text" onPress={() => router.back()}>
          Cancel
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  section: {
    marginBottom: 16,
  },
  hint: {
    marginTop: 2,
    marginBottom: 8,
    opacity: 0.85,
  },
  scheduleBtn: {
    marginTop: 4,
  },
  coords: {
    marginBottom: 8,
    opacity: 0.8,
  },
  locationLoad: {
    marginVertical: 8,
  },
  cameraWrap: {
    flex: 1,
    minHeight: 300,
    borderRadius: 6,
    overflow: 'hidden',
    marginVertical: 16,
  },
  camera: {
    flex: 1,
  },
  cameraActions: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 4,
    borderColor: '#2e7d32',
  },
  preview: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImg: {
    width: '100%',
    flex: 1,
    resizeMode: 'contain',
  },
  error: {
    color: '#b00020',
    marginVertical: 8,
  },
  actions: {
    gap: 8,
  },
});
