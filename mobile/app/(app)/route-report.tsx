import { colors, spacing } from '@/constants/theme';
import { localWeekStartYmd } from '@/lib/dateLocal';
import { api, type Route, type Visit } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Text,
  TextInput,
} from 'react-native-paper';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function formatDate(iso: string): string {
  const raw = String(iso ?? '').trim();
  if (!raw) return '—';
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Prefill remarks from visit step-3 fields when there is no saved report yet. */
function buildPrefillRemarksFromVisits(visits: Visit[]): string {
  if (visits.length === 0) return '';
  const lines: string[] = [];
  const cropStages = visits.map((v) => v.crop_stage).filter(Boolean);
  const feedbacks = visits.map((v) => v.farmers_feedback).filter(Boolean);
  if (cropStages.length) {
    lines.push(`Crop stages (from visits): ${cropStages.join('; ')}`);
  }
  if (feedbacks.length) {
    lines.push(`Farmer feedback (from visits): ${feedbacks.join('; ')}`);
  }
  return lines.join('\n\n');
}

function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function reportDataToRemarks(data?: Record<string, unknown> | null): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  const direct = toText(d.remarks).trim();
  if (direct) return toText(d.remarks);

  const parts: string[] = [];
  const push = (title: string, ...keys: string[]) => {
    for (const key of keys) {
      const v = toText(d[key]).trim();
      if (v) {
        parts.push(`${title}\n${v}`);
        return;
      }
    }
  };
  push('Summary', 'summary');
  push('Challenges', 'challenges', 'issues');
  push('Next actions', 'next_actions', 'next_steps');
  push('Farmer feedback', 'farmer_feedback', 'farmers_feedback_summary');
  push('Notes', 'notes');
  const crop = toText(d.crop_stages_summary).trim();
  if (crop) parts.push(`Crop stages (from visits)\n${crop}`);
  const fb = toText(d.farmers_feedback_summary).trim();
  if (fb) parts.push(`Farmer feedback (from visits)\n${fb}`);
  return parts.join('\n\n');
}

function formToReportData(remarks: string, visitsCount: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (remarks.trim()) out.remarks = remarks.trim();
  if (visitsCount >= 0) out.visits_count = visitsCount;
  return out;
}

export default function RouteReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [remarks, setRemarks] = useState('');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const weekStart = useMemo(() => localWeekStartYmd(new Date()), []);

  const loadRoutes = useCallback(async () => {
    try {
      const arr = await api.getAllRoutes({ week_start: weekStart });
      // End-of-day report only applies to routes where at least one visit was recorded for that route.
      const withVisits = await Promise.all(
        arr.map(async (r) => {
          try {
            const v = await api.getAllVisits({ route: r.id });
            return v.length > 0 ? r : null;
          } catch {
            return null;
          }
        })
      );
      setRoutes(withVisits.filter((x): x is Route => x != null));
    } catch {
      setRoutes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const loadReportAndVisits = useCallback(async (route: Route) => {
    setSelectedRoute(route);
    setError('');
    try {
      const [reportRes, visitsRes] = await Promise.all([
        api.getRouteReport(route.id),
        // Visits for this route only (avoid created_at date mismatch vs scheduled_date).
        api.getAllVisits({ route: route.id }),
      ]);
      setVisits(Array.isArray(visitsRes) ? visitsRes : []);
      const existing = reportRes.report_data;
      const visitList = Array.isArray(visitsRes) ? visitsRes : [];
      if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) {
        setRemarks(reportDataToRemarks(existing as Record<string, unknown>));
      } else {
        setRemarks(buildPrefillRemarksFromVisits(visitList));
      }
    } catch {
      setError('Failed to load report.');
      setVisits([]);
      setRemarks('');
    }
  }, []);

  const submitReport = useCallback(async () => {
    if (!selectedRoute) return;
    const data = formToReportData(remarks, visits.length);
    setSaving(true);
    setError('');
    try {
      await api.submitRouteReport(selectedRoute.id, data);
      setSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit.');
      setSaving(false);
    }
  }, [selectedRoute, remarks, visits.length]);

  const clearSelection = useCallback(() => {
    setSelectedRoute(null);
    setRemarks('');
    setVisits([]);
    setError('');
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.BackAction onPress={() => (selectedRoute ? clearSelection() : router.back())} />
        <Appbar.Content title={selectedRoute ? `Report: ${formatDate(selectedRoute.scheduled_date)}` : 'Route reports'} />
      </Appbar.Header>

      {!selectedRoute ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRoutes(); }} />}
        >
          <Text variant="bodyMedium" style={styles.hint}>
            Only routes with at least one recorded visit appear here. After 6 PM you can fill the end-of-day report; visit notes may be prefilled in remarks.
          </Text>
          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : routes.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>
              No routes with recorded visits this week. Record visits linked to a route (from Schedules or Record visit), then your route will show here for the report.
            </Text>
          ) : (
            routes.map((r) => (
              <Card key={r.id} style={styles.card} onPress={() => loadReportAndVisits(r)}>
                <Card.Content>
                  <Text variant="titleMedium">{formatDate(r.scheduled_date)}</Text>
                  <Text variant="bodySmall" style={styles.cardSub}>{r.name || 'Day route'}</Text>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {visits.length > 0 && (
            <Text variant="bodySmall" style={styles.prefillHint}>
              {visits.length} visit(s) recorded for this route — count is saved with the report. Edit remarks as needed.
            </Text>
          )}
          <Text variant="labelMedium" style={styles.fieldLabel}>Remarks</Text>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            mode="outlined"
            multiline
            numberOfLines={12}
            placeholder="Summarize the day: coverage, challenges, farmer feedback, follow-ups, etc."
            style={styles.input}
          />
          <View style={styles.actions}>
            <Button mode="contained" onPress={submitReport} loading={saving} disabled={saving}>
              Submit report
            </Button>
            <Button mode="outlined" onPress={clearSelection} disabled={saving}>
              Back to list
            </Button>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  appbar: { backgroundColor: colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  hint: { color: colors.gray700, marginBottom: spacing.lg },
  loader: { marginVertical: spacing.xl },
  empty: { color: colors.gray700 },
  card: { marginBottom: spacing.md },
  cardSub: { color: colors.gray700, marginTop: 4 },
  prefillHint: { color: colors.gray700, marginBottom: spacing.sm },
  fieldLabel: { marginBottom: spacing.xs, color: colors.gray700 },
  input: { marginBottom: spacing.md },
  actions: { gap: spacing.md },
  errorText: { color: colors.error, marginBottom: spacing.sm },
});
