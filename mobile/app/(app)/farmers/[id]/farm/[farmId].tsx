/**
 * Farm detail screen: Farm info, Visits to this farm, and Products given (from those visits).
 */
import { colors, radius, spacing } from '@/constants/theme';
import { getFarms as getFarmsDb } from '@/database';
import { api, getLabels, type Farm, type Visit } from '@/lib/api';
import { farmRowToFarm } from '@/lib/offline-helpers';
import { appMeta$ } from '@/store/observable';
import { useSelector } from '@legendapp/state/react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, List, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ListItemRow from '@/components/ListItemRow';

type TabKey = 'farm' | 'visits' | 'products';

function farmLocationLabel(farm: Farm): string {
  const parts = [farm.village];
  if (farm.sub_county || farm.county) parts.push(farm.sub_county || farm.county || '');
  return parts.filter(Boolean).join(', ');
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function FarmDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; farmId: string }>();
  const farmerId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const farmId = typeof params.farmId === 'string' ? params.farmId : Array.isArray(params.farmId) ? params.farmId[0] : undefined;

  const [farm, setFarm] = useState<Farm | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('farm');
  const labels = useSelector(() => getLabels(appMeta$.cachedOptions.get()));

  const load = useCallback(async () => {
    if (!farmerId || !farmId) {
      setError('Missing farmer or farm');
      setLoading(false);
      return;
    }
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected) {
      try {
        const [farmsData, visitsData] = await Promise.all([
          api.getFarms(farmerId),
          api.getVisits({ farm: farmId }),
        ]);
        const farmsList = Array.isArray(farmsData) ? farmsData : [];
        const found = farmsList.find((f) => f.id === farmId) ?? null;
        setFarm(found);
        setVisits(Array.isArray(visitsData) ? visitsData : []);
        setError(found ? '' : `${labels.location} not found`);
      } catch (e) {
        const farmRows = await getFarmsDb(farmerId);
        const farmsList = farmRows.map(farmRowToFarm);
        const found = farmsList.find((f) => f.id === farmId) ?? null;
        setFarm(found);
        setVisits([]);
        setError(found ? '' : `${labels.location} not found`);
      }
    } else {
      const farmRows = await getFarmsDb(farmerId);
      const farmsList = farmRows.map(farmRowToFarm);
      const found = farmsList.find((f) => f.id === farmId) ?? null;
      setFarm(found);
      setVisits([]);
      setError(found ? '' : `${labels.location} not found`);
    }
    setLoading(false);
    setRefreshing(false);
  }, [farmerId, farmId, labels.location]);

  useEffect(() => {
    if (farmerId && farmId) {
      setLoading(true);
      load();
    }
  }, [farmerId, farmId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const openVisit = (visitId: string) => router.push({ pathname: '/visits/[id]', params: { id: visitId } });

  // Products given: from visits' product_lines where quantity_given > 0, aggregated by product
  const productsGiven = (() => {
    const byProduct: Record<string, { name: string; code?: string; unit?: string; total: number; visits: number }> = {};
    for (const v of visits) {
      const lines = v.product_lines ?? [];
      for (const line of lines) {
        const qty = parseFloat(line.quantity_given || '0') || 0;
        if (qty <= 0) continue;
        const key = line.product_id;
        if (!byProduct[key]) {
          byProduct[key] = { name: line.product_name ?? 'Product', code: line.product_code, unit: line.product_unit, total: 0, visits: 0 };
        }
        byProduct[key].total += qty;
        byProduct[key].visits += 1;
      }
    }
    return Object.entries(byProduct).map(([id, data]) => ({ id, ...data }));
  })();

  if (!farmerId || !farmId) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title={labels.location} />
        </Appbar.Header>
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={styles.error}>Missing farmer or farm</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={farm?.village ?? labels.location} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : error || !farm ? (
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={styles.error}>{error || `${labels.location} not found`}</Text>
        </View>
      ) : (
        <>
          <View style={styles.tabRow}>
            <Pressable style={[styles.tab, activeTab === 'farm' && styles.tabActive]} onPress={() => setActiveTab('farm')}>
              <Text variant="titleSmall" style={[styles.tabLabel, activeTab === 'farm' && styles.tabLabelActive]}>{labels.location}</Text>
              {activeTab === 'farm' && <View style={styles.tabIndicator} />}
            </Pressable>
            <Pressable style={[styles.tab, activeTab === 'visits' && styles.tabActive]} onPress={() => setActiveTab('visits')}>
              <Text variant="titleSmall" style={[styles.tabLabel, activeTab === 'visits' && styles.tabLabelActive]}>Visits</Text>
              {activeTab === 'visits' && <View style={styles.tabIndicator} />}
            </Pressable>
            <Pressable style={[styles.tab, activeTab === 'products' && styles.tabActive]} onPress={() => setActiveTab('products')}>
              <Text variant="titleSmall" style={[styles.tabLabel, activeTab === 'products' && styles.tabLabelActive]}>Products given</Text>
              {activeTab === 'products' && <View style={styles.tabIndicator} />}
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'farm' && (
              <Card style={styles.card} mode="outlined">
                <Card.Content>
                  <List.Item title="Village" description={farm.village || '—'} left={(props) => <List.Icon {...props} icon="map-marker" />} />
                  <List.Item title="Location" description={farmLocationLabel(farm)} left={(props) => <List.Icon {...props} icon="map-marker-radius" />} />
                  {farm.plot_size && (
                    <>
                      {farm.plot_size && <List.Item title="Plot size" description={farm.plot_size} left={(props) => <List.Icon {...props} icon="square-outline" />} />}
                    </>
                  )}
                  <List.Item title="Coordinates" description={`${farm.latitude?.toFixed(5)}, ${farm.longitude?.toFixed(5)}`} left={(props) => <List.Icon {...props} icon="crosshairs-gps" />} />
                </Card.Content>
              </Card>
            )}

            {activeTab === 'visits' && (
              <>
                {visits.length === 0 ? (
                  <Card style={styles.card} mode="outlined">
                    <Card.Content>
                      <Text variant="bodyMedium" style={styles.muted}>No visits recorded for this {labels.location.toLowerCase()} yet.</Text>
                    </Card.Content>
                  </Card>
                ) : (
                  <View style={styles.list}>
                    {visits.map((v) => (
                      <ListItemRow
                        key={v.id}
                        avatarLetter={(v.officer_display_name || v.officer_email || '?').charAt(0)}
                        title={formatDate(v.created_at)}
                        subtitle={v.officer_display_name ?? v.officer_email ?? '—'}
                        onPress={() => openVisit(v.id)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            {activeTab === 'products' && (
              <>
                {productsGiven.length === 0 ? (
                  <Card style={styles.card} mode="outlined">
                    <Card.Content>
                      <Text variant="bodyMedium" style={styles.muted}>No products given at this {labels.location.toLowerCase()} yet.</Text>
                    </Card.Content>
                  </Card>
                ) : (
                  <View style={styles.list}>
                    {productsGiven.map((p) => (
                      <Card key={p.id} style={styles.productCard} mode="outlined">
                        <Card.Content style={styles.productCardContent}>
                          <View style={styles.productRow}>
                            <MaterialCommunityIcons name="package-variant" size={22} color={colors.primary} style={styles.productIcon} />
                            <View style={styles.productBody}>
                              <Text variant="titleSmall" style={styles.productName}>{p.name}</Text>
                              {(p.code || p.unit) && (
                                <Text variant="bodySmall" style={styles.muted}>{[p.code, p.unit].filter(Boolean).join(' · ')}</Text>
                              )}
                              <Text variant="bodyMedium" style={styles.productQty}>Total given: {p.total}{p.unit ? ` ${p.unit}` : ''} ({p.visits} visit{p.visits !== 1 ? 's' : ''})</Text>
                            </View>
                          </View>
                        </Card.Content>
                      </Card>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: colors.error, textAlign: 'center' },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingHorizontal: spacing.sm,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: {},
  tabLabel: { color: colors.gray500, fontWeight: '600' },
  tabLabelActive: { color: colors.primary },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '8%',
    right: '8%',
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  card: { marginBottom: spacing.lg, borderRadius: radius.card },
  list: { gap: spacing.sm },
  productCard: { borderRadius: radius.card, marginBottom: spacing.sm },
  productCardContent: { paddingVertical: spacing.md },
  productRow: { flexDirection: 'row', alignItems: 'flex-start' },
  productIcon: { marginRight: spacing.md },
  productBody: { flex: 1 },
  productName: { fontWeight: '600', color: colors.gray900, marginBottom: 2 },
  productQty: { marginTop: 4, color: colors.gray700 },
  muted: { color: colors.gray500 },
});
