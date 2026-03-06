import { getFarmers as getFarmersDb, getFarms as getFarmsDb } from '@/database';
import { farmRowToFarm, farmerRowToFarmer } from '@/lib/offline-helpers';
import { api, type Farmer, type Farm } from '@/lib/api';
import { colors, radius, spacing } from '@/constants/theme';
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
  const openRecordVisit = () =>
    router.push({ pathname: '/(app)/record-visit', params: { farmerId: id ?? undefined } });

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
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.muted}>Loading…</Text>
            </Card.Content>
          </Card>
        ) : error ? (
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.error}>{error}</Text>
              <Button mode="outlined" onPress={load} style={styles.retryBtn}>
                Retry
              </Button>
            </Card.Content>
          </Card>
        ) : farmer ? (
          <>
            <View style={styles.hero}>
              <View style={styles.avatarWrap}>
                <Text variant="headlineMedium" style={styles.avatarLetter}>
                  {(farmer.display_name || 'F').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text variant="headlineSmall" style={styles.heroName}>
                {farmer.display_name}
              </Text>
              {(farmer.phone || farmer.crop_type) && (
                <View style={styles.heroMeta}>
                  {farmer.phone ? (
                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="phone" size={18} color={colors.gray700} />
                      <Text variant="bodyMedium" style={styles.metaText}>{farmer.phone}</Text>
                    </View>
                  ) : null}
                  {farmer.crop_type ? (
                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="sprout" size={18} color={colors.gray700} />
                      <Text variant="bodyMedium" style={styles.metaText}>{farmer.crop_type}</Text>
                    </View>
                  ) : null}
                </View>
              )}
              <Button
                mode="contained"
                icon="calendar-check"
                onPress={openRecordVisit}
                style={styles.recordVisitBtn}
              >
                Record visit
              </Button>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={styles.sectionTitle}>Farms</Text>
                <Button mode="contained-tonal" compact onPress={openAddFarm} icon="plus">
                  Add farm
                </Button>
              </View>

              {farms.length === 0 ? (
                <Card style={styles.emptyCard} elevation={0}>
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.muted}>No farms yet. Add a farm location for this farmer.</Text>
                    <Button mode="outlined" onPress={openAddFarm} style={styles.addFarmBtn}>
                      Add farm
                    </Button>
                  </Card.Content>
                </Card>
              ) : (
                <View style={styles.farmList}>
                  {farms.map((farm) => (
                    <Card key={farm.id} style={styles.farmCard} elevation={0}>
                      <Card.Content style={styles.farmCardContent}>
                        <View style={styles.farmRow}>
                          <View style={styles.farmIconWrap}>
                            <MaterialCommunityIcons name="map-marker" size={20} color={colors.primary} />
                          </View>
                          <View style={styles.farmBody}>
                            <Text variant="titleSmall" style={styles.farmVillage}>{farm.village}</Text>
                            <Text variant="bodySmall" style={styles.farmLocation}>
                              {farmLocationLabel(farm)}
                            </Text>
                            {(farm.plot_size || farm.crop_type) && (
                              <Text variant="bodySmall" style={styles.farmMeta}>
                                {[farm.plot_size, farm.crop_type].filter(Boolean).join(' · ')}
                              </Text>
                            )}
                          </View>
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.lg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.gray200 },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarLetter: { color: colors.primary, fontWeight: '700' },
  heroName: { fontWeight: '700', color: colors.gray900, marginBottom: spacing.sm },
  heroMeta: { marginBottom: spacing.lg, alignItems: 'center', gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { color: colors.gray700 },
  recordVisitBtn: { minWidth: 200 },
  section: { marginTop: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: { fontWeight: '600', color: colors.gray900 },
  emptyCard: {
    marginBottom: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  addFarmBtn: { marginTop: spacing.md },
  retryBtn: { marginTop: spacing.sm },
  farmList: { gap: spacing.sm },
  farmCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  farmCardContent: { paddingVertical: spacing.md },
  farmRow: { flexDirection: 'row', alignItems: 'flex-start' },
  farmIconWrap: { marginRight: spacing.md, marginTop: 2 },
  farmBody: { flex: 1 },
  farmVillage: { fontWeight: '600', color: colors.gray900, marginBottom: 2 },
  farmLocation: { color: colors.gray700, marginBottom: 2 },
  farmMeta: { color: colors.gray500 },
  error: { marginBottom: spacing.sm, color: colors.error },
  muted: { color: colors.gray500 },
});
