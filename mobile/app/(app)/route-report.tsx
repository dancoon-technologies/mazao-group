import { colors, spacing } from '@/constants/theme';
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
  try {
    return new Date(iso + 'Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
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

export default function RouteReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [report, setReport] = useState<RouteReport | null>(null);
  const [reportData, setReportData] = useState<string>('');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
  }, []);

  const loadRoutes = useCallback(async () => {
    try {
      const list = await api.getRoutes({ week_start: weekStart });
      setRoutes(Array.isArray(list) ? list : []);
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
        api.getVisits({ date: route.scheduled_date, route: route.id }),
      ]);
      setReport(reportRes);
      setVisits(Array.isArray(visitsRes) ? visitsRes : []);
      const existing = reportRes.report_data;
      if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) {
        setReportData(JSON.stringify(existing, null, 2));
      } else {
        const prefill = buildPrefillFromVisits(Array.isArray(visitsRes) ? visitsRes : []);
        setReportData(Object.keys(prefill).length > 0 ? JSON.stringify(prefill, null, 2) : '');
      }
    } catch {
      setError('Failed to load report.');
      setReport(null);
      setVisits([]);
      setReportData('');
    }
  }, []);

  const submitReport = useCallback(async () => {
    if (!selectedRoute) return;
    let data: Record<string, unknown>;
    try {
      data = reportData.trim() ? JSON.parse(reportData) : {};
    } catch {
      setError('Invalid JSON. Use a valid JSON object or leave empty.');
      return;
    }
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
  }, [selectedRoute, reportData]);

  const clearSelection = useCallback(() => {
    setSelectedRoute(null);
    setReport(null);
    setReportData('');
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
            After 6 PM you can fill the end-of-day report for each route. If you recorded visits with additional details, they are prefilled below.
          </Text>
          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : routes.length === 0 ? (
            <Text variant="bodyMedium" style={styles.empty}>No routes this week. Add routes under Plan visits → Weekly routes.</Text>
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
              {visits.length} visit(s) recorded for this route. Summary has been prefilled below — edit as needed.
            </Text>
          )}
          <Text variant="labelMedium" style={styles.fieldLabel}>Report data (JSON)</Text>
          <TextInput
            value={reportData}
            onChangeText={setReportData}
            mode="outlined"
            multiline
            numberOfLines={12}
            placeholder='{"summary": "Today I visited...", "issues": ""}'
            style={styles.textArea}
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
  textArea: { minHeight: 200, marginBottom: spacing.lg },
  actions: { gap: spacing.md },
  errorText: { color: colors.error, marginBottom: spacing.sm },
});
