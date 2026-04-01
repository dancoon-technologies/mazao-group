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

export default function FarmersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshTrigger } = useAppRefresh();
  const prevRefreshTrigger = useRef(0);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farmsByFarmer, setFarmsByFarmer] = useState<Record<string, Farm[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadFromDb = useCallback(async () => {
    const [farmerRows, farmRows] = await Promise.all([
      getFarmersDb({ is_stockist: false }),
      getAllFarms(),
    ]);
    const list = farmerRows.map(farmerRowToFarmer);
    setFarmers(list);
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
        const [farmersData, farmsData] = await Promise.all([
          api.getFarmers(
            searchQuery?.trim()
              ? { search: searchQuery.trim(), is_stockist: false }
              : { is_stockist: false }
          ),
          api.getFarms(),
        ]);
        const list = Array.isArray(farmersData) ? farmersData : [];
        setFarmers(list);
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

  // Refetch when app returns to foreground and sync completed (e.g. after unlock)
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

  const filteredFarmers = useMemo(() => {
    if (!search.trim()) return farmers;
    const q = search.trim().toLowerCase();
    return farmers.filter(
      (f) =>
        f.display_name.toLowerCase().includes(q) ||
        (f.phone ?? '').toLowerCase().includes(q)
    );
  }, [farmers, search]);

  const openAddFarmer = useCallback(() => router.push('/(app)/add-farmer'), [router]);
  const openFarmer = useCallback((id: string) => router.push({ pathname: '/farmers/[id]', params: { id } }), [router]);

  const renderFarmerItem = useCallback(
    ({ item: farmer }: { item: Farmer }) => {
      const farms = farmsByFarmer[farmer.id] ?? [];
      const farmCount = farms.length;
      const locations = formatFarmLocations(farms);
      const partnerType = farmer.is_group ? 'Farmers Group' : 'Farmer';
      const subtitle = [
        partnerType,
        farmer.phone ? farmer.phone : null,
        farmCount === 1 ? '1 Farm' : `${farmCount} Farms`,
        locations ? locations : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return (
        <ListItemRow
          avatarLetter={farmer.display_name}
          title={farmer.display_name}
          subtitle={subtitle || '—'}
          onPress={() => openFarmer(farmer.id)}
        />
      );
    },
    [farmsByFarmer, openFarmer]
  );

  const listEmptyComponent = useMemo(
    () => (
      <Card style={styles.card} elevation={0}>
        <Card.Content>
          <Text variant="bodyMedium">
            {search.trim() ? 'No farmers match your search.' : 'No farmers'}
          </Text>
          {!search.trim() && (
            <Button mode="contained" onPress={openAddFarmer} style={styles.addBtn}>
              Add farmer
            </Button>
          )}
        </Card.Content>
      </Card>
    ),
    [search.trim(), openAddFarmer]
  );

  return (
    <View style={styles.container}>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="bodyLarge" style={styles.title}>Farmers</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Manage assigned farmers.
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
          data={filteredFarmers}
          keyExtractor={(item) => item.id}
          renderItem={renderFarmerItem}
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
          icon="account-plus"
          onPress={openAddFarmer}
          style={styles.fab}
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addButtonLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
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
  cardList: { gap: 0 },
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
});
