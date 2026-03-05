import { api, type Farm, type Farmer } from '@/lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  FAB,
  Text,
  useTheme,
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
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farmsByFarmer, setFarmsByFarmer] = useState<Record<string, Farm[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (searchQuery?: string) => {
    try {
      const [farmersData, farmsData] = await Promise.all([
        api.getFarmers(searchQuery?.trim() ? { search: searchQuery.trim() } : undefined),
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
      setError(e instanceof Error ? e.message : 'Failed to load farmers');
      setFarmers([]);
      setFarmsByFarmer({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const openAddFarmer = () => router.push('/(app)/add-farmer');

  return (
    <View style={styles.container}>
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Manage assigned farmers.
          </Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={theme.colors.onSurfaceVariant}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
          placeholder="Search by name or phone..."
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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
        ) : filteredFarmers.length === 0 ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium">
                {search.trim() ? 'No farmers match your search.' : 'No farmers'}
              </Text>
              {!search.trim() && (
                <Button
                  mode="contained"
                  onPress={openAddFarmer}
                  style={styles.addBtn}
                >
                  Add Farmer
                </Button>
              )}
            </Card.Content>
          </Card>
        ) : (
          <View style={styles.cardList}>
            {filteredFarmers.map((farmer) => {
              const farms = farmsByFarmer[farmer.id] ?? [];
              const farmCount = farms.length;
              const locations = formatFarmLocations(farms);
              return (
                <TouchableOpacity
                  key={farmer.id}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: '/farmers/[id]',
                      params: { id: farmer.id },
                    })
                  }
                >
                  <Card style={styles.farmerCard} elevation={0}>
                    <Card.Content>
                      <Text variant="titleMedium" style={styles.cardName}>
                        {farmer.display_name}
                      </Text>
                      {farmer.phone ? (
                        <View style={styles.cardRow}>
                          <MaterialCommunityIcons
                            name="phone"
                            size={18}
                            color={theme.colors.onSurfaceVariant}
                            style={styles.cardIcon}
                          />
                          <Text variant="bodyMedium" style={styles.cardMeta}>
                            {farmer.phone}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.cardRow}>
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={18}
                          color={theme.colors.onSurfaceVariant}
                          style={styles.cardIcon}
                        />
                        <Text variant="bodyMedium" style={styles.cardMeta}>
                          {farmCount === 1 ? '1 Farm' : `${farmCount} Farms`}
                        </Text>
                      </View>
                      {locations ? (
                        <Text
                          variant="bodySmall"
                          style={styles.cardLocations}
                          numberOfLines={2}
                        >
                          {locations}
                        </Text>
                      ) : null}
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
      <View
        style={[
          styles.fabWrap,
          {
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 8,
          },
        ]}
        pointerEvents="box-none"
      >
        <FAB
          icon="plus"
          onPress={openAddFarmer}
          mode="elevated"
          label="Add Farmer"
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerText: { flex: 1 },
  title: { fontWeight: '700' },
  subtitle: { opacity: 0.7, marginTop: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addButtonLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  scroll: { flex: 1 },
  content: { paddingBottom: 24, paddingHorizontal: 20 },
  loader: { marginVertical: 24 },
  card: { marginBottom: 16 },
  error: { marginBottom: 8 },
  addBtn: { marginTop: 12 },
  cardList: { gap: 12 },
  farmerCard: {
    borderRadius: 12,
    elevation: 0,
  },
  cardName: { fontWeight: '700', marginBottom: 6 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardIcon: { marginRight: 6 },
  cardMeta: { flex: 1 },
  cardLocations: {
    opacity: 0.75,
    marginTop: 4,
    marginLeft: 24,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
});
