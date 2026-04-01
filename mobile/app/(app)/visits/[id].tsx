/**
 * Visit detail screen: show visit details, report record, and verification status (accepted/rejected by supervisor).
 */
import { useAuth } from '@/contexts/AuthContext';
import { api, getLabels, type Visit } from '@/lib/api';
import { appMeta$ } from '@/store/observable';
import { useSelector } from '@legendapp/state/react';
import { visitStatusColor, visitStatusLabel } from '@/lib/format';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Appbar, Card, Divider, List, Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE } from '@/constants/config';
import { colors, radius, spacing } from '@/constants/theme';

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Build full URL for visit photo (API may return relative path). */
function getPhotoUrl(photo: string | undefined): string | null {
  if (!photo?.trim()) return null;
  if (photo.startsWith('http://') || photo.startsWith('https://')) return photo;
  const base = API_BASE.replace(/\/api\/?$/, '');
  return `${base}${photo.startsWith('/') ? '' : '/'}${photo}`;
}

function activityLabel(value: string): string {
  const labels: Record<string, string> = {
    farm_to_farm_visits: 'Farm to farm visits',
    order_collection: 'Order collection',
    debt_collections: 'Debt collections',
    account_opening: 'Account opening',
    key_farm_visits: 'Key farm visits',
    group_training: 'Group training',
    demo_set_up: 'Demo set up',
    spot_demo: 'Spot demo',
    reporting: 'Reporting',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

export default function VisitDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const visitId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const labels = useSelector(() => getLabels(appMeta$.cachedOptions.get()));

  const load = useCallback(async () => {
    if (!visitId) {
      setError('Missing visit id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const v = await api.getVisit(visitId);
      setVisit(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visit');
      setVisit(null);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Visit details" />
        </Appbar.Header>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !visit) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Visit details" />
        </Appbar.Header>
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={styles.error}>{error || 'Visit not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = (visit.verification_status || '').toLowerCase();
  const statusColor = visitStatusColor(visit.verification_status);
  const statusLabel = visitStatusLabel(visit.verification_status);
  const photoUrl = getPhotoUrl(visit.photo);
  const partnerTypeLabel =
    visit.partner_is_stockist == null
      ? null
      : visit.partner_is_stockist
        ? 'Stockist'
        : 'Farmer';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Visit details" />
      </Appbar.Header>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Verification status: Accepted / Rejected by supervisor */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="labelMedium" style={styles.sectionLabel}>Supervisor decision</Text>
            <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
              {status === 'rejected' && (
                <MaterialCommunityIcons name="alert" size={20} color={statusColor} style={styles.badgeIcon} />
              )}
              <Text variant="titleMedium" style={[styles.badgeText, { color: statusColor }]}>
                {status === 'verified' ? 'Accepted' : status === 'rejected' ? 'Rejected' : statusLabel}
              </Text>
            </View>
            <Text variant="bodySmall" style={styles.hint}>
              {status === 'verified'
                ? 'This visit record has been accepted by your supervisor.'
                : status === 'rejected'
                  ? 'This visit record was rejected by your supervisor. You may need to resubmit or correct the visit.'
                  : 'Pending supervisor review.'}
            </Text>
          </Card.Content>
        </Card>

        {/* Visit details */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="labelMedium" style={styles.sectionLabel}>Visit details</Text>
            <List.Item
              title="Officer"
              description={
                <>
                  <Text variant="bodyMedium">{visit.officer_display_name || visit.officer_email || visit.officer || '—'}</Text>
                  {visit.officer_email ? <Text variant="bodySmall" style={styles.muted}>{visit.officer_email}</Text> : null}
                </>
              }
              left={(props) => <List.Icon {...props} icon="account-tie" />}
            />
            <Divider />
            <List.Item title={labels.partner} description={visit.farmer_display_name ?? '—'} left={(props) => <List.Icon {...props} icon="account" />} />
            {partnerTypeLabel && (
              <>
                <Divider />
                <List.Item title="Partner type" description={partnerTypeLabel} left={(props) => <List.Icon {...props} icon="tag" />} />
              </>
            )}
            <Divider />
            <List.Item title={labels.location} description={visit.farm_display_name ?? `No specific ${labels.location.toLowerCase()}`} left={(props) => <List.Icon {...props} icon="barn" />} />
            <Divider />
            <List.Item title="Date & time" description={formatDateTime(visit.created_at)} left={(props) => <List.Icon {...props} icon="calendar-clock" />} />
            <Divider />
            <List.Item title="Activity type" description={activityLabel(visit.activity_type)} left={(props) => <List.Icon {...props} icon="clipboard-list" />} />
            {visit.distance_from_farmer != null && (
              <>
                <Divider />
                <List.Item title={`Distance from ${labels.partner.toLowerCase()}/${labels.location.toLowerCase()}`} description={`${Math.round(visit.distance_from_farmer)} m`} left={(props) => <List.Icon {...props} icon="map-marker" />} />
              </>
            )}
          </Card.Content>
        </Card>

        {/* Photo */}
        {photoUrl && (
          <Card style={styles.card} mode="outlined">
            <Card.Content>
              <Text variant="labelMedium" style={styles.sectionLabel}>Photo evidence</Text>
              <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
              {visit.photo_place_name ? (
                <Text variant="bodySmall" style={styles.hint}>{visit.photo_place_name}</Text>
              ) : null}
              {visit.photo_taken_at ? (
                <Text variant="bodySmall" style={styles.hint}>Taken: {formatDateTime(visit.photo_taken_at)}</Text>
              ) : null}
            </Card.Content>
          </Card>
        )}

        {/* Report record: notes and additional fields */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="labelMedium" style={styles.sectionLabel}>Report record</Text>
            {visit.notes ? (
              <>
                <Text variant="labelSmall" style={styles.fieldLabel}>Notes</Text>
                <Text variant="bodyMedium" style={styles.fieldValue}>{visit.notes}</Text>
              </>
            ) : null}
            {(visit.crop_stage || visit.germination_percent != null || visit.survival_rate || visit.pests_diseases || visit.order_value != null || visit.harvest_kgs != null || visit.farmers_feedback) ? (
              <View style={styles.reportFields}>
                {visit.crop_stage ? (<View><Text variant="labelSmall" style={styles.fieldLabel}>Crop stage</Text><Text variant="bodyMedium" style={styles.fieldValue}>{visit.crop_stage}</Text></View>) : null}
                {visit.germination_percent != null ? (<View><Text variant="labelSmall" style={styles.fieldLabel}>Germination %</Text><Text variant="bodyMedium" style={styles.fieldValue}>{String(visit.germination_percent)}</Text></View>) : null}
                {visit.survival_rate ? (<View><Text variant="labelSmall" style={styles.fieldLabel}>Survival rate</Text><Text variant="bodyMedium" style={styles.fieldValue}>{visit.survival_rate}</Text></View>) : null}
                {visit.pests_diseases ? (<View><Text variant="labelSmall" style={styles.fieldLabel}>Pests/Diseases</Text><Text variant="bodyMedium" style={styles.fieldValue}>{visit.pests_diseases}</Text></View>) : null}
                {visit.order_value != null ? (<View><Text variant="labelSmall" style={styles.fieldLabel}>Order value</Text><Text variant="bodyMedium" style={styles.fieldValue}>{String(visit.order_value)}</Text></View>) : null}
                {visit.stockist_payment_amount != null ? (<View><Text variant="labelSmall" style={styles.fieldLabel}>Stockist payment</Text><Text variant="bodyMedium" style={styles.fieldValue}>{String(visit.stockist_payment_amount)}</Text></View>) : null}
                {visit.harvest_kgs != null ? (<View><Text variant="labelSmall" style={styles.fieldLabel}>Harvest (kg)</Text><Text variant="bodyMedium" style={styles.fieldValue}>{String(visit.harvest_kgs)}</Text></View>) : null}
                {visit.farmers_feedback ? (<View><Text variant="labelSmall" style={styles.fieldLabel}>{labels.partner}&apos;s feedback</Text><Text variant="bodyMedium" style={styles.fieldValue}>{visit.farmers_feedback}</Text></View>) : null}
              </View>
            ) : null}
            {!visit.notes && !visit.crop_stage && visit.germination_percent == null && !visit.survival_rate && !visit.pests_diseases && visit.order_value == null && visit.stockist_payment_amount == null && visit.harvest_kgs == null && !visit.farmers_feedback && (
              <Text variant="bodySmall" style={styles.hint}>No additional notes or report fields.</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: colors.error, textAlign: 'center' },
  card: { marginBottom: spacing.lg, borderRadius: radius.card },
  sectionLabel: { marginBottom: spacing.sm, fontWeight: '600', color: colors.gray700 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    gap: 6,
  },
  badgeIcon: {},
  badgeText: { fontWeight: '600' },
  hint: { marginTop: 2, opacity: 0.85 },
  muted: { color: colors.gray500, marginTop: 2 },
  photo: { width: '100%', height: 240, borderRadius: radius.sm, marginTop: spacing.sm, backgroundColor: colors.gray100 },
  fieldLabel: { marginTop: spacing.sm, color: colors.gray700 },
  fieldValue: { marginTop: 2 },
  reportFields: { marginTop: spacing.xs },
});
