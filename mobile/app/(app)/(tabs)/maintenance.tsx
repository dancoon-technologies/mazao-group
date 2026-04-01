import { useAuth } from '@/contexts/AuthContext';
import {
  api,
  type MaintenanceIncident,
  type MaintenanceStatus,
} from '@/lib/api';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  reported: 'Reported',
  verified_breakdown: 'Verified breakdown',
  at_garage: 'At garage',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_COLOR: Record<MaintenanceStatus, string> = {
  reported: colors.warning,
  verified_breakdown: colors.primary,
  at_garage: '#6d28d9',
  approved: '#15803d',
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
      setItems(
        [...list].sort(
          (a, b) =>
            new Date(b.reported_at || b.created_at || 0).getTime() -
            new Date(a.reported_at || a.created_at || 0).getTime()
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load maintenance records.');
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
    setSubmitting(true);
    setError('');
    try {
      const coords = await getCurrentCoords();
      await api.createMaintenanceIncident({
        vehicle_type: vehicleType,
        issue_description: issueDescription.trim(),
        reported_latitude: coords.latitude,
        reported_longitude: coords.longitude,
      });
      setIssueDescription('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit maintenance report.');
    } finally {
      setSubmitting(false);
    }
  }, [getCurrentCoords, isOfficer, issueDescription, load, vehicleType]);

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
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update maintenance status.');
      } finally {
        setSubmitting(false);
      }
    },
    [getCurrentCoords, isSupervisor, load, supervisorNote]
  );

  const openItems = useMemo(
    () => items.filter((x) => x.status !== 'approved' && x.status !== 'rejected'),
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
          Maintenance control
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          Report breakdowns and verify progression to garage and approval.
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
              <Button
                mode="contained"
                onPress={submitIncident}
                loading={submitting}
                disabled={submitting}
              >
                Submit with current GPS
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
                    Reported: {formatWhen(item.reported_at)} · GPS:{' '}
                    {item.reported_latitude ?? '—'}, {item.reported_longitude ?? '—'}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    Breakdown verified: {formatWhen(item.breakdown_verified_at)} · GPS:{' '}
                    {item.breakdown_verified_latitude ?? '—'},{' '}
                    {item.breakdown_verified_longitude ?? '—'}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    Garage recorded: {formatWhen(item.garage_recorded_at)} · GPS:{' '}
                    {item.garage_latitude ?? '—'}, {item.garage_longitude ?? '—'}
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
                            Verify breakdown (GPS)
                          </Button>
                        ) : null}
                        {item.status === 'verified_breakdown' ? (
                          <Button
                            mode="contained-tonal"
                            onPress={() => updateStatus(item, 'at_garage')}
                            disabled={submitting}
                          >
                            Mark at garage (GPS)
                          </Button>
                        ) : null}
                        {item.status === 'at_garage' ? (
                          <View style={styles.rowActions}>
                            <Button
                              mode="contained"
                              onPress={() => updateStatus(item, 'approved')}
                              disabled={submitting}
                            >
                              Approve
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
  errorText: { color: colors.error },
  loader: { marginTop: spacing.xl },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  desc: { marginTop: spacing.sm, marginBottom: spacing.sm },
  meta: { opacity: 0.8, marginBottom: 2 },
  statusChip: { alignSelf: 'flex-start' },
  actions: { marginTop: spacing.sm, gap: spacing.sm },
  rowActions: { flexDirection: 'row', gap: spacing.sm },
});
