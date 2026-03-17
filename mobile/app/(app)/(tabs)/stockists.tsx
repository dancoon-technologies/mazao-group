import { cardShadow, cardStyle, colors, spacing } from '@/constants/theme';
import { getFarmers as getFarmersDb, getAllFarms } from '@/database';
import { farmRowToFarm, farmerRowToFarmer } from '@/lib/offline-helpers';
import { api, type Farm, type Farmer } from '@/lib/api';
import { useAppRefresh } from '@/contexts/AppRefreshContext';
import { useFocusEffect, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ListItemRow } from '@/components/ListItemRow';
import {
  ActivityIndicator,
  Button,
  Card,
  FAB,
  Searchbar,
  Text,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 56;

function formatFarmLocations(farms: Farm[]): string {
  if (farms.length === 0) return '';
  return farms
    .map((f) => `${f.village}${f.sub_county || f.county ? `, ${f.sub_county || f.county}` : ''}`)
    .join(' • ');
}

export default function StockistsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshTrigger } = useAppRefresh();
  const prevRefreshTrigger = useRef(0);
  const [stockists, setStockists] = useState<Farmer[]>([]);
  const [farmsByFarmer, setFarmsByFarmer] = useState<Record<string, Farm[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadFromDb = useCallback(async () => {
    const [farmerRows, farmRows] = await Promise.all([
      getFarmersDb({ is_stockist: true }),
      getAllFarms(),
    ]);
    const list = farmerRows.map(farmerRowToFarmer);
    setStockists(list);
    const byFarmer: Record<string, Farm[]> = {};
    for (const row of farmRows) {
      const farm = farmRowToFarm(row);
      if (!byFarmer[farm.farmer]) byFarmer[farm.farmer] = [];
      byFarmer[farm.farmer].push(farm);
    }
    setFarmsByFarmer(byFarmer);
    setError('');
  }, []);

  const load = useCallback(async (searchQuery?: string) => {
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected) {
      try {
        const [stockistsData, farmsData] = await Promise.all([
          api.getFarmers(
            searchQuery?.trim()
              ? { search: searchQuery.trim(), is_stockist: true }
              : { is_stockist: true }
          ),
          api.getFarms(),
        ]);
        const list = Array.isArray(stockistsData) ? stockistsData : [];
        setStockists(list);
        const byFarmer: Record<string, Farm[]> = {};
        const farms = Array.isArray(farmsData) ? farmsData : [];
        for (const farm of farms) {
          if (!byFarmer[farm.farmer]) byFarmer[farm.farmer] = [];
          byFarmer[farm.farmer].push(farm);
        }
        setFarmsByFarmer(byFarmer);
        setError('');
      } catch (e) {
        await loadFromDb();
      }
    } else {
      await loadFromDb();
    }
    setLoading(false);
    setRefreshing(false);
  }, [loadFromDb]);

  useEffect(() => {
    if (refreshTrigger > 0 && refreshTrigger !== prevRefreshTrigger.current) {
      prevRefreshTrigger.current = refreshTrigger;
      load(search.trim() || undefined);
    }
  }, [refreshTrigger, load, search]);

  useFocusEffect(useCallback(() => {
    load(search.trim() || undefined);
  }, [load, search]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(search.trim() || undefined);
  }, [load, search]);

  const onSearchSubmit = useCallback(() => {
    setLoading(true);
    load(search.trim() || undefined);
  }, [load, search]);

  const filteredStockists = useMemo(() => {
    if (!search.trim()) return stockists;
    const q = search.trim().toLowerCase();
    return stockists.filter(
      (f) =>
        f.display_name.toLowerCase().includes(q) ||
        (f.phone ?? '').toLowerCase().includes(q)
    );
  }, [stockists, search]);

  const openAddStockist = useCallback(
    () => router.push({ pathname: '/(app)/add-farmer', params: { asStockist: '1' } }),
    [router]
  );
  const openStockist = useCallback(
    (id: string) => router.push({ pathname: '/farmers/[id]', params: { id } }),
    [router]
  );

  const renderItem = useCallback(
    ({ item: stockist }: { item: Farmer }) => {
      const farms = farmsByFarmer[stockist.id] ?? [];
      const farmCount = farms.length;
      const locations = formatFarmLocations(farms);
      const subtitle = [
        stockist.phone ? stockist.phone : null,
        farmCount === 1 ? '1 location' : `${farmCount} locations`,
        locations ? locations : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return (
        <ListItemRow
          avatarLetter={stockist.display_name}
          title={stockist.display_name}
          subtitle={subtitle || '—'}
          onPress={() => openStockist(stockist.id)}
        />
      );
    },
    [farmsByFarmer, openStockist]
  );

  const listEmptyComponent = useMemo(
    () => (
      <Card style={styles.card} elevation={0}>
        <Card.Content>
          <Text variant="bodyMedium">
            {search.trim() ? 'No stockists match your search.' : 'No stockists'}
          </Text>
          {!search.trim() && (
            <Button mode="contained" onPress={openAddStockist} style={[styles.addBtn, styles.fabStockistBtn]}>
              Add stockist
            </Button>
          )}
        </Card.Content>
      </Card>
    ),
    [search.trim(), openAddStockist]
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="bodyLarge" style={styles.title}>Stockists</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Manage stockists and outlets.
            </Text>
          </View>
        </View>

        <Searchbar
          placeholder="Search by name or phone..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearchSubmit}
          style={styles.searchbar}
        />

        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : error ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.error}>
                {error}
              </Text>
              <Button mode="outlined" onPress={() => load()}>
                Retry
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <FlatList
            data={filteredStockists}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={listEmptyComponent}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
      <View
        style={[styles.fabWrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 4 }]}
        pointerEvents="box-none"
      >
        <FAB
          icon="store-outline"
          onPress={openAddStockist}
          style={[styles.fab, styles.fabStockist]}
          color="#fff"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1 },
  title: { fontWeight: '700', fontSize: 20 },
  subtitle: { opacity: 0.7, marginTop: 2 },
  searchbar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
  loader: { marginVertical: 24 },
  card: { ...cardStyle, ...cardShadow, marginBottom: 16 },
  error: { marginBottom: 8 },
  addBtn: { marginTop: 12 },
  fabStockistBtn: { backgroundColor: colors.accent },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  fab: {
    backgroundColor: colors.primary,
  },
  fabStockist: {
    backgroundColor: colors.accent,
  },
});
