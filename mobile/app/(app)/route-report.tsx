import { colors, spacing } from '@/constants/theme';
import { localWeekStartYmd } from '@/lib/dateLocal';
import { api, type Route, type RouteReport, type Visit } from '@/lib/api';
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

/** Build prefill summary from visits linked to this route (additional fields from step 3). */
function buildPrefillFromVisits(visits: Visit[]): Record<string, unknown> {
  if (visits.length === 0) return {};
  const summary: Record<string, unknown> = {
    visits_count: visits.length,
    prefilled_from_visits: true,
  };
  const cropStages = visits.map((v) => v.crop_stage).filter(Boolean);
  const feedbacks = visits.map((v) => v.farmers_feedback).filter(Boolean);
  if (cropStages.length) summary.crop_stages_summary = cropStages.join('; ');
  if (feedbacks.length) summary.farmers_feedback_summary = feedbacks.join('; ');
  return summary;
}

type RouteReportForm = {
  summary: string;
  challenges: string;
  next_actions: string;
  farmer_feedback: string;
  notes: string;
  visits_count: string;
};

const EMPTY_FORM: RouteReportForm = {
  summary: '',
  challenges: '',
  next_actions: '',
  farmer_feedback: '',
  notes: '',
  visits_count: '',
};

function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function reportDataToForm(data?: Record<string, unknown> | null): RouteReportForm {
  if (!data || typeof data !== 'object') return { ...EMPTY_FORM };
  return {
    summary: toText(data.summary),
    challenges: toText(data.challenges ?? data.issues),
    next_actions: toText(data.next_actions ?? data.next_steps),
    farmer_feedback: toText(data.farmer_feedback ?? data.farmers_feedback_summary),
    notes: toText(data.notes),
    visits_count: toText(data.visits_count),
  };
}

function formToReportData(form: RouteReportForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (form.summary.trim()) out.summary = form.summary.trim();
  if (form.challenges.trim()) out.challenges = form.challenges.trim();
  if (form.next_actions.trim()) out.next_actions = form.next_actions.trim();
  if (form.farmer_feedback.trim()) out.farmer_feedback = form.farmer_feedback.trim();
  if (form.notes.trim()) out.notes = form.notes.trim();
  const count = Number.parseInt(form.visits_count.trim(), 10);
  if (!Number.isNaN(count) && count >= 0) out.visits_count = count;
  return out;
}

export default function RouteReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [report, setReport] = useState<RouteReport | null>(null);
  const [form, setForm] = useState<RouteReportForm>({ ...EMPTY_FORM });
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
      setReport(reportRes);
      setVisits(Array.isArray(visitsRes) ? visitsRes : []);
      const existing = reportRes.report_data;
      if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) {
        setForm(reportDataToForm(existing as Record<string, unknown>));
      } else {
        const prefill = buildPrefillFromVisits(Array.isArray(visitsRes) ? visitsRes : []);
        setForm(reportDataToForm(prefill));
      }
    } catch {
      setError('Failed to load report.');
      setReport(null);
      setVisits([]);
      setForm({ ...EMPTY_FORM });
    }
  }, []);

  const submitReport = useCallback(async () => {
    if (!selectedRoute) return;
    const data = formToReportData(form);
    setSaving(true);
    setError('');
    try {
      await api.submitRouteReport(selectedRoute.id, data);
      setReport((prev) => (prev ? { ...prev, report_data: data, submitted_at: new Date().toISOString() } : null));
      setSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit.');
      setSaving(false);
    }
  }, [selectedRoute, form]);

  const clearSelection = useCallback(() => {
    setSelectedRoute(null);
    setReport(null);
    setForm({ ...EMPTY_FORM });
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
            Only routes with at least one recorded visit appear here. After 6 PM you can fill the end-of-day report; if visits include extra details, fields below are prefilled.
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
                  <Text variant="bodySmall" style={styles.cardSub}>{r.name || 'Route'} · {r.stops?.length ?? 0} stops</Text>
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
              {visits.length} visit(s) recorded for this route. Some fields are prefilled below.
            </Text>
          )}
          <Text variant="labelMedium" style={styles.fieldLabel}>Route summary</Text>
          <TextInput
            value={form.summary}
            onChangeText={(value) => setForm((prev) => ({ ...prev, summary: value }))}
            mode="outlined"
            multiline
            numberOfLines={4}
            placeholder="What happened on this route today?"
            style={styles.input}
          />
          <Text variant="labelMedium" style={styles.fieldLabel}>Challenges</Text>
          <TextInput
            value={form.challenges}
            onChangeText={(value) => setForm((prev) => ({ ...prev, challenges: value }))}
            mode="outlined"
            multiline
            numberOfLines={3}
            placeholder="Any blockers, missed stops, stock issues, etc."
            style={styles.input}
          />
          <Text variant="labelMedium" style={styles.fieldLabel}>Farmer feedback</Text>
          <TextInput
            value={form.farmer_feedback}
            onChangeText={(value) => setForm((prev) => ({ ...prev, farmer_feedback: value }))}
            mode="outlined"
            multiline
            numberOfLines={3}
            placeholder="Key feedback collected from farmers/stockists"
            style={styles.input}
          />
          <Text variant="labelMedium" style={styles.fieldLabel}>Next actions</Text>
          <TextInput
            value={form.next_actions}
            onChangeText={(value) => setForm((prev) => ({ ...prev, next_actions: value }))}
            mode="outlined"
            multiline
            numberOfLines={3}
            placeholder="Follow-ups for tomorrow or this week"
            style={styles.input}
          />
          <Text variant="labelMedium" style={styles.fieldLabel}>Visits count</Text>
          <TextInput
            value={form.visits_count}
            onChangeText={(value) => setForm((prev) => ({ ...prev, visits_count: value.replace(/[^\d]/g, '') }))}
            mode="outlined"
            keyboardType="numeric"
            placeholder="e.g. 8"
            style={styles.input}
          />
          <Text variant="labelMedium" style={styles.fieldLabel}>Additional notes</Text>
          <TextInput
            value={form.notes}
            onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
            mode="outlined"
            multiline
            numberOfLines={3}
            placeholder="Anything else to include"
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
