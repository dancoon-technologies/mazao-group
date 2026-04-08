import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/constants/config';
import {
  api,
  type MaintenanceIncident,
  type MaintenanceStatus,
} from '@/lib/api';
import NetInfo from '@react-native-community/netinfo';
import { RecordVisitCameraModal } from '@/components/recordVisit/RecordVisitCameraModal';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { logger } from '@/lib/logger';
import { maintenanceIncidents$ } from '@/store/observable';

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  reported: 'Reported',
  verified_breakdown: 'Verified breakdown',
  at_garage: 'Fixing reported',
  released: 'Acknowledged',
  rejected: 'Rejected',
};

const STATUS_COLOR: Record<MaintenanceStatus, string> = {
  reported: colors.warning,
  verified_breakdown: colors.primary,
  at_garage: '#6d28d9',
  released: '#15803d',
  rejected: colors.error,
};


function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getIncidentPhotoUrl(photo: string): string {
  if (photo.startsWith('http://') || photo.startsWith('https://')) return photo;
  const base = API_BASE.replace(/\/api\/?$/, '');
  return `${base}${photo.startsWith('/') ? '' : '/'}${photo}`;
}

export default function MaintenanceScreen() {
  const { role } = useAuth();
  const isSupervisor = role === 'supervisor' || role === 'admin';
  const isOfficer = role === 'officer';
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<MaintenanceIncident[]>([]);
  const [vehicleType, setVehicleType] = useState<'motorbike' | 'car' | 'other'>('motorbike');
  const [issueDescription, setIssueDescription] = useState('');
  const [supervisorNote, setSupervisorNote] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<{ uri: string; type?: string; name?: string }[]>([]);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const load = useCallback(async (asRefresh?: boolean) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const online = await NetInfo.fetch().then((s) => s.isConnected ?? false);
      if (!online) {
        const cached = maintenanceIncidents$.get();
        setItems(cached ?? []);
        setError(cached ? 'Offline — showing saved records.' : 'Offline — no saved records yet.');
        return;
      }
      const list = await api.getMaintenanceIncidents();
      logger.info('Maintenance incidents loaded', { incidents_count: list.length, as_refresh: !!asRefresh });
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.reported_at || b.created_at || 0).getTime() -
          new Date(a.reported_at || a.created_at || 0).getTime()
      );
      setItems(sorted);
      maintenanceIncidents$.set(sorted);
    } catch (e) {
      const cached = maintenanceIncidents$.get();
      if (cached) {
        setItems(cached);
        setError('Showing saved records (sync failed).');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load maintenance records.');
        setItems([]);
      }
      logger.warn('Maintenance incidents load failed', {
        as_refresh: !!asRefresh,
        error: e instanceof Error ? e.message : 'load failed',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const getCurrentCoords = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Could not get location right now.');
    }
    if (Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
      } catch {
        // ignore
      }
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  }, []);

  const submitIncident = useCallback(async () => {
    if (!isOfficer) return;
    if (!issueDescription.trim()) {
      setError('Describe what broke down.');
      return;
    }
    if (photos.length === 0) {
      setError('Take at least one photo before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const coords = await getCurrentCoords();
      if (
        typeof coords.latitude !== 'number' ||
        typeof coords.longitude !== 'number' ||
        !Number.isFinite(coords.latitude) ||
        !Number.isFinite(coords.longitude)
      ) {
        throw new Error('Could not read GPS coordinates. Try again after a fix.');
      }
      await api.createMaintenanceIncident({
        vehicle_type: vehicleType,
        issue_description: issueDescription.trim(),
        reported_latitude: coords.latitude,
        reported_longitude: coords.longitude,
        photo: photos,
      });
      logger.info('Maintenance incident submitted', {
        vehicle_type: vehicleType,
        photos_count: photos.length,
        reported_latitude: coords.latitude,
        reported_longitude: coords.longitude,
      });
      setIssueDescription('');
      setPhotos([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit maintenance report.');
      logger.warn('Maintenance incident submit failed', {
        vehicle_type: vehicleType,
        photos_count: photos.length,
        error: e instanceof Error ? e.message : 'submit failed',
      });
    } finally {
      setSubmitting(false);
    }
  }, [getCurrentCoords, isOfficer, issueDescription, load, photos, vehicleType]);

  const openCameraModal = useCallback(async () => {
    setError('');
    if (!cameraPermission?.granted) {
      const req = await requestCameraPermission();
      if (!req.granted) {
        setError('Camera permission is required to take breakdown photos.');
        return;
      }
    }
    setCameraModalVisible(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !cameraPermission?.granted) return;
    try {
      const takenAt = new Date().toISOString();
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true,
        additionalExif: {
          DateTimeOriginal: takenAt.replace(/\.\d{3}Z$/, ''),
        },
      });
      if (photo?.uri) {
        setPhotos((prev) => [
          ...prev,
          {
            uri: photo.uri,
            type: 'image/jpeg',
            name: `breakdown_${Date.now()}.jpg`,
          },
        ]);
        setCameraModalVisible(false);
      }
    } catch {
      setError('Could not capture photo. Try again.');
    }
  }, [cameraPermission?.granted]);

  const updateStatus = useCallback(
    async (incident: MaintenanceIncident, nextStatus: MaintenanceStatus) => {
      if (!isSupervisor && !isOfficer) return;
      if (nextStatus === 'at_garage' && photos.length === 0) {
        setError('Take at least one photo before confirming issue is fixed.');
        return;
      }
      setSubmitting(true);
      setError('');
      try {
        const payload: Parameters<typeof api.updateMaintenanceIncident>[1] = {
          status: nextStatus,
          supervisor_notes: isSupervisor ? supervisorNote[incident.id]?.trim() || undefined : undefined,
        };
        if (nextStatus === 'at_garage') {
          const coords = await getCurrentCoords();
          payload.garage_latitude = coords.latitude;
          payload.garage_longitude = coords.longitude;
        }
        await api.updateMaintenanceIncident(incident.id, payload);
        logger.info('Maintenance incident status updated', {
          incident_id: incident.id,
          from_status: incident.status,
          to_status: nextStatus,
          actor_role: role,
          photos_count: nextStatus === 'at_garage' ? photos.length : undefined,
        });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update maintenance status.');
        logger.warn('Maintenance incident status update failed', {
          incident_id: incident.id,
          from_status: incident.status,
          to_status: nextStatus,
          actor_role: role,
          error: e instanceof Error ? e.message : 'update failed',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [getCurrentCoords, isOfficer, isSupervisor, load, photos.length, role, supervisorNote]
  );

  const openItems = useMemo(
    () => items.filter((x) => x.status !== 'released' && x.status !== 'rejected'),
    [items]
  );
  const reportedItems = useMemo(
    () => openItems.filter((x) => x.status === 'reported'),
    [openItems]
  );
  const fixingItems = useMemo(
    () => openItems.filter((x) => x.status === 'at_garage'),
    [openItems]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void load(true);
            }}
          />
        }
      >
        <Text variant="titleLarge" style={styles.title}>
          Report incidence
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          Flow: report issue with photo, then confirm fixed and photos taken, then supervisor acknowledges.
        </Text>

        {isOfficer && (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="labelLarge" style={styles.sectionTitle}>
                1) Report issue
              </Text>
              <SegmentedButtons
                value={vehicleType}
                onValueChange={(v) =>
                  setVehicleType(v as 'motorbike' | 'car' | 'other')
                }
                buttons={[
                  { value: 'motorbike', label: 'Motorbike' },
                  { value: 'car', label: 'Car' },
                  { value: 'other', label: 'Other' },
                ]}
                style={styles.segment}
              />
              <TextInput
                mode="outlined"
                label="Issue description"
                value={issueDescription}
                onChangeText={setIssueDescription}
                multiline
                numberOfLines={3}
                style={styles.input}
                placeholder="e.g. puncture, engine overheating, brake failure"
              />
              <Text variant="labelMedium" style={styles.photoLabel}>Photos *</Text>
              {photos.length > 0 ? (
                <View style={styles.photosRow}>
                  {photos.map((photo, index) => (
                    <View key={`${photo.uri}-${index}`} style={styles.photoThumbWrap}>
                      <Image source={{ uri: photo.uri }} style={styles.photoThumb} contentFit="cover" />
                      <Button
                        mode="text"
                        compact
                        icon="close"
                        onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                        style={styles.photoThumbRemove}
                        accessibilityLabel="Remove photo"
                      >
                        {' '}
                      </Button>
                    </View>
                  ))}
                  <Pressable style={styles.photoAddBtn} onPress={() => void openCameraModal()}>
                    <MaterialCommunityIcons name="camera-plus" size={40} color={colors.primary} />
                    <Text variant="bodySmall" style={styles.photoAddLabel}>Add photo</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.photoPlaceholder} onPress={() => void openCameraModal()}>
                  <MaterialCommunityIcons name="camera" size={48} color={colors.gray500} />
                  <Text variant="bodyLarge" style={styles.photoPlaceholderText}>Add photo</Text>
                  <Text variant="bodySmall" style={styles.photoPlaceholderHint}>Minimum 1</Text>
                </Pressable>
              )}
              <Button
                mode="contained"
                onPress={() => void submitIncident()}
                loading={submitting}
                disabled={submitting}
              >
                Report incident
              </Button>
            </Card.Content>
          </Card>
        )}

        {error ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.errorText}>
                {error}
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" />
          </View>
        ) : openItems.length === 0 ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium">No open incidents.</Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            {reportedItems.length > 0 ? (
              <Text variant="titleSmall" style={styles.stageTitle}>
                2) Awaiting fixing report
              </Text>
            ) : null}
            {reportedItems.map((item) => {
              const badgeColor = STATUS_COLOR[item.status] ?? colors.gray500;
              return (
                <Card key={item.id} style={styles.card} elevation={0}>
                  <Card.Content>
                    <View style={styles.row}>
                      <Text variant="titleMedium">
                        {(item.officer_display_name ||
                          item.officer_email ||
                          'Officer') + ` · ${item.vehicle_type}`}
                      </Text>
                      <Chip
                        compact
                        style={[styles.statusChip, { backgroundColor: `${badgeColor}20` }]}
                        textStyle={{ color: badgeColor, fontWeight: '700' }}
                      >
                        {STATUS_LABEL[item.status] ?? item.status}
                      </Chip>
                    </View>
                    <Text variant="bodyMedium" style={styles.desc}>
                      {item.issue_description || '—'}
                    </Text>
                    {item.photos && item.photos.length > 0 ? (
                      <View style={styles.readonlyPhotosRow}>
                        {item.photos.map((uri, index) => (
                          <View key={`${item.id}-${uri}-${index}`} style={styles.readonlyPhotoThumbWrap}>
                            <Image source={{ uri: getIncidentPhotoUrl(uri) }} style={styles.readonlyPhotoThumb} contentFit="cover" />
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Text variant="bodySmall" style={styles.meta}>
                      Reported: {formatWhen(item.reported_at)}
                    </Text>

                    {isOfficer && (
                      <View style={styles.actions}>
                        {photos.length === 0 ? (
                          <Text variant="bodySmall" style={styles.helperText}>
                            Capture at least one photo above before confirming fixed.
                          </Text>
                        ) : null}
                        <Button
                          mode="contained-tonal"
                          onPress={() => void updateStatus(item, 'at_garage')}
                          disabled={submitting || photos.length === 0}
                        >
                          I have fixed and taken photos
                        </Button>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              );
            })}

            {fixingItems.length > 0 ? (
              <Text variant="titleSmall" style={styles.stageTitle}>
                3) Awaiting supervisor acknowledgement
              </Text>
            ) : null}
            {fixingItems.map((item) => {
            const badgeColor = STATUS_COLOR[item.status] ?? colors.gray500;
            return (
              <Card key={item.id} style={styles.card} elevation={0}>
                <Card.Content>
                  <View style={styles.row}>
                    <Text variant="titleMedium">
                      {(item.officer_display_name ||
                        item.officer_email ||
                        'Officer') + ` · ${item.vehicle_type}`}
                    </Text>
                    <Chip
                      compact
                      style={[styles.statusChip, { backgroundColor: `${badgeColor}20` }]}
                      textStyle={{ color: badgeColor, fontWeight: '700' }}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Chip>
                  </View>
                  <Text variant="bodyMedium" style={styles.desc}>
                    {item.issue_description || '—'}
                  </Text>
                  {item.photos && item.photos.length > 0 ? (
                    <View style={styles.readonlyPhotosRow}>
                      {item.photos.map((uri, index) => (
                        <View key={`${item.id}-${uri}-${index}`} style={styles.readonlyPhotoThumbWrap}>
                          <Image source={{ uri: getIncidentPhotoUrl(uri) }} style={styles.readonlyPhotoThumb} contentFit="cover" />
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text variant="bodySmall" style={styles.meta}>
                    Reported issue: {formatWhen(item.reported_at)}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    Reported fixing: {formatWhen(item.garage_recorded_at)}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    Acknowledged: {formatWhen(item.released_at)}
                  </Text>

                  {isSupervisor && (
                    <>
                      <TextInput
                        mode="outlined"
                        label="Supervisor note (optional)"
                        value={supervisorNote[item.id] ?? ''}
                        onChangeText={(text) =>
                          setSupervisorNote((prev) => ({ ...prev, [item.id]: text }))
                        }
                        style={styles.input}
                      />
                      <View style={styles.actions}>
                        {item.status === 'at_garage' ? (
                          <View style={styles.rowActions}>
                            <Button
                              mode="contained"
                              onPress={() => void updateStatus(item, 'released')}
                              disabled={submitting}
                            >
                              Acknowledge
                            </Button>
                            <Button
                              mode="outlined"
                              onPress={() => void updateStatus(item, 'rejected')}
                              disabled={submitting}
                            >
                              Reject
                            </Button>
                          </View>
                        ) : null}
                      </View>
                    </>
                  )}
                </Card.Content>
              </Card>
            );
          })}
          </>
        )}
      </ScrollView>
      <RecordVisitCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        cameraRef={cameraRef}
        onCapture={() => void takePhoto()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 4, opacity: 0.8, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  sectionTitle: { marginBottom: spacing.sm },
  stageTitle: { marginBottom: spacing.xs, marginTop: spacing.xs, fontWeight: '700' },
  segment: { marginBottom: spacing.md },
  input: { marginBottom: spacing.sm },
  photoLabel: { marginBottom: spacing.xs, fontWeight: '600' },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'flex-start' },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  photoThumbRemove: { position: 'absolute', top: -4, right: -4, minWidth: 28, margin: 0 },
  photoAddBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primaryLight}66`,
  },
  photoAddLabel: { marginTop: 4, color: colors.primary },
  photoPlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: '#F9FAFB',
  },
  photoPlaceholderText: { color: '#374151', marginTop: spacing.xs },
  photoPlaceholderHint: { color: '#6B7280', marginTop: 2 },
  readonlyPhotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  readonlyPhotoThumbWrap: { position: 'relative' },
  readonlyPhotoThumb: { width: 80, height: 80, borderRadius: 8 },
  errorText: { color: colors.error },
  loader: { marginTop: spacing.xl },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  desc: { marginTop: spacing.sm, marginBottom: spacing.sm },
  meta: { opacity: 0.8, marginBottom: 2 },
  statusChip: { alignSelf: 'flex-start' },
  actions: { marginTop: spacing.sm, gap: spacing.sm },
  helperText: { opacity: 0.8 },
  rowActions: { flexDirection: 'row', gap: spacing.sm },
});
