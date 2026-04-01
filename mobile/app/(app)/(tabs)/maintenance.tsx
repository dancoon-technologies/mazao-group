import { useAuth } from '@/contexts/AuthContext';
import {
  api,
  type MaintenanceIncident,
  type MaintenanceStatus,
} from '@/lib/api';
import NetInfo from '@react-native-community/netinfo';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  reported: 'Reported',
  verified_breakdown: 'Verified breakdown',
  at_garage: 'At garage',
  released: 'Released',
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

export default function MaintenanceScreen() {
  const { role } = useAuth();
  const isSupervisor = role === 'supervisor';
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const load = useCallback(async (asRefresh?: boolean) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const online = await NetInfo.fetch().then((s) => s.isConnected ?? false);
      if (!online) {
        setError('Connect to load maintenance records.');
        setItems([]);
        return;
      }
      const list = await api.getMaintenanceIncidents();
      logger.info('Maintenance incidents loaded', { incidents_count: list.length, as_refresh: !!asRefresh });
      setItems(
        [...list].sort(
          (a, b) =>
            new Date(b.reported_at || b.created_at || 0).getTime() -
            new Date(a.reported_at || a.created_at || 0).getTime()
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load maintenance records.');
      logger.warn('Maintenance incidents load failed', {
        as_refresh: !!asRefresh,
        error: e instanceof Error ? e.message : 'load failed',
      });
      setItems([]);
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
      throw new Error('Location permission is required.');
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
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

  const openCamera = useCallback(async () => {
    setError('');
    if (!cameraPermission?.granted) {
      const req = await requestCameraPermission();
      if (!req.granted) {
        setError('Camera permission is required to take breakdown photos.');
        return;
      }
    }
    setCameraOpen(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const capturePhoto = useCallback(async () => {
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (!shot?.uri) return;
      setPhotos((prev) => [
        ...prev,
        {
          uri: shot.uri,
          type: 'image/jpeg',
          name: `breakdown_${Date.now()}.jpg`,
        },
      ]);
      setCameraOpen(false);
    } catch {
      setError('Could not capture photo. Try again.');
    }
  }, []);

  const updateStatus = useCallback(
    async (incident: MaintenanceIncident, nextStatus: MaintenanceStatus) => {
      if (!isSupervisor) return;
      setSubmitting(true);
      setError('');
      try {
        const payload: Parameters<typeof api.updateMaintenanceIncident>[1] = {
          status: nextStatus,
          supervisor_notes: supervisorNote[incident.id]?.trim() || undefined,
        };
        if (nextStatus === 'verified_breakdown') {
          const coords = await getCurrentCoords();
          payload.breakdown_verified_latitude = coords.latitude;
          payload.breakdown_verified_longitude = coords.longitude;
        }
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
        });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update maintenance status.');
        logger.warn('Maintenance incident status update failed', {
          incident_id: incident.id,
          from_status: incident.status,
          to_status: nextStatus,
          error: e instanceof Error ? e.message : 'update failed',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [getCurrentCoords, isSupervisor, load, supervisorNote]
  );

  const openItems = useMemo(
    () => items.filter((x) => x.status !== 'released' && x.status !== 'rejected'),
    [items]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
      >
        <Text variant="titleLarge" style={styles.title}>
          Report breakdown
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          Report a vehicle breakdown for supervisor review and approval.
        </Text>

        {isOfficer && (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="labelLarge" style={styles.sectionTitle}>
                Report breakdown
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
              <View style={styles.photoRow}>
                <Button mode="outlined" onPress={openCamera} disabled={submitting}>
                  Take picture
                </Button>
                <Text variant="bodySmall">Photos attached: {photos.length}</Text>
              </View>
              <Button
                mode="contained"
                onPress={submitIncident}
                loading={submitting}
                disabled={submitting}
              >
                Submit report
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
          openItems.map((item) => {
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
                  <Text variant="bodySmall" style={styles.meta}>
                    Reported: {formatWhen(item.reported_at)}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    Breakdown verified: {formatWhen(item.breakdown_verified_at)}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    Garage recorded: {formatWhen(item.garage_recorded_at)}
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
                        {item.status === 'reported' ? (
                          <Button
                            mode="contained-tonal"
                            onPress={() => updateStatus(item, 'verified_breakdown')}
                            disabled={submitting}
                          >
                            Verify breakdown
                          </Button>
                        ) : null}
                        {item.status === 'verified_breakdown' ? (
                          <Button
                            mode="contained-tonal"
                            onPress={() => updateStatus(item, 'at_garage')}
                            disabled={submitting}
                          >
                            Mark at garage
                          </Button>
                        ) : null}
                        {item.status === 'at_garage' ? (
                          <View style={styles.rowActions}>
                            <Button
                              mode="contained"
                              onPress={() => updateStatus(item, 'released')}
                              disabled={submitting}
                            >
                              Mark released
                            </Button>
                            <Button
                              mode="outlined"
                              onPress={() => updateStatus(item, 'rejected')}
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
          })
        )}
        <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
          <View style={styles.cameraModal}>
            <View style={styles.cameraHeader}>
              <Text variant="titleMedium">Take picture</Text>
              <Pressable onPress={() => setCameraOpen(false)} hitSlop={12}>
                <Text variant="titleLarge">×</Text>
              </Pressable>
            </View>
            <View style={styles.cameraBody}>
              <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />
              <View style={styles.cameraActions}>
                <Pressable style={styles.captureButton} onPress={capturePhoto}>
                  <View style={styles.captureInner} />
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
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
  segment: { marginBottom: spacing.md },
  input: { marginBottom: spacing.sm },
  photoRow: { marginBottom: spacing.sm, gap: spacing.sm },
  errorText: { color: colors.error },
  loader: { marginTop: spacing.xl },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  desc: { marginTop: spacing.sm, marginBottom: spacing.sm },
  meta: { opacity: 0.8, marginBottom: 2 },
  statusChip: { alignSelf: 'flex-start' },
  actions: { marginTop: spacing.sm, gap: spacing.sm },
  rowActions: { flexDirection: 'row', gap: spacing.sm },
  cameraModal: { flex: 1, backgroundColor: '#000' },
  cameraHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cameraBody: { flex: 1 },
  cameraActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.xl,
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
});
