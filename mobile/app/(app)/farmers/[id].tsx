import { getFarmers as getFarmersDb, getFarms as getFarmsDb } from '@/database';
import { farmRowToFarm, farmerRowToFarmer } from '@/lib/offline-helpers';
import { api, type Farmer, type Farm } from '@/lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import React, { useCallback, useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

function farmLocationLabel(farm: Farm): string {
  const parts = [farm.village];
  if (farm.sub_county || farm.county) parts.push(farm.sub_county || farm.county || '');
  return parts.filter(Boolean).join(', ');
}

export default function FarmerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFromDb = useCallback(async () => {
    if (!id) return;
    const [farmerRows, farmRows] = await Promise.all([
      getFarmersDb(),
      getFarmsDb(id),
    ]);
    const found = farmerRows.find((r) => r.id === id);
    setFarmer(found ? farmerRowToFarmer(found) : null);
    setFarms(farmRows.map(farmRowToFarm));
    setError(found ? '' : 'Farmer not found');
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    const connected = await NetInfo.fetch().then((s) => s.isConnected ?? false);
    if (connected) {
      try {
        const [farmersData, farmsData] = await Promise.all([
          api.getFarmers(),
          api.getFarms(id),
        ]);
        const list = Array.isArray(farmersData) ? farmersData : [];
        const found = list.find((f) => f.id === id) ?? null;
        setFarmer(found);
        setFarms(Array.isArray(farmsData) ? farmsData : []);
        setError(found ? '' : 'Farmer not found');
      } catch (e) {
        await loadFromDb();
      }
    } else {
      await loadFromDb();
    }
    setLoading(false);
    setRefreshing(false);
  }, [id, loadFromDb]);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused && id) load();
  }, [isFocused, id, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const openAddFarm = () => router.push({ pathname: '/farmers/[id]/add-farm', params: { id: id! } });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={farmer?.display_name ?? 'Farmer'} />
      </Appbar.Header>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium">Loading…</Text>
            </Card.Content>
          </Card>
        ) : error ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.error}>{error}</Text>
              <Button mode="outlined" onPress={load}>Retry</Button>
            </Card.Content>
          </Card>
        ) : farmer ? (
          <>
            <Card style={styles.card} elevation={0}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.cardTitle}>{farmer.display_name}</Text>
                {farmer.phone ? <Text variant="bodyMedium">Phone: {farmer.phone}</Text> : null}
                {farmer.crop_type ? <Text variant="bodyMedium">Crop: {farmer.crop_type}</Text> : null}
              </Card.Content>
            </Card>

            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Farms</Text>
              <Button mode="contained-tonal" compact onPress={openAddFarm} icon="plus">
                Add farm
              </Button>
            </View>

            {farms.length === 0 ? (
              <Card style={styles.card} elevation={0}>
                <Card.Content>
                  <Text variant="bodyMedium" style={styles.muted}>No farms yet.</Text>
                  <Button mode="outlined" onPress={openAddFarm} style={styles.addFarmBtn}>
                    Add farm
                  </Button>
                </Card.Content>
              </Card>
            ) : (
              farms.map((farm) => (
                <Card key={farm.id} style={styles.farmCard} elevation={0}>
                  <Card.Content>
                    <View style={styles.farmRow}>
                      <MaterialCommunityIcons name="map-marker" size={20} style={styles.farmIcon} />
                      <Text variant="bodyLarge" style={styles.farmVillage}>{farm.village}</Text>
                    </View>
                    <Text variant="bodySmall" style={styles.farmLocation}>
                      {farmLocationLabel(farm)}
                    </Text>
                    {(farm.plot_size || farm.crop_type) ? (
                      <Text variant="bodySmall" style={styles.farmMeta}>
                        {[farm.plot_size, farm.crop_type].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  card: { marginBottom: 16 },
  cardTitle: { fontWeight: '700', marginBottom: 4 },
  error: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: '600' },
  muted: { opacity: 0.8, marginBottom: 8 },
  addFarmBtn: { marginTop: 8 },
  farmCard: { marginBottom: 12 },
  farmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  farmIcon: { marginRight: 8 },
  farmVillage: { fontWeight: '600' },
  farmLocation: { opacity: 0.85, marginLeft: 28 },
  farmMeta: { opacity: 0.75, marginTop: 4, marginLeft: 28 },
});
