import { api, type Farmer } from '@/lib/api';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import {
  Appbar,
  List,
  Divider,
  Avatar,
  ActivityIndicator,
  Text,
  Button,
  Card,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function FarmersScreen() {
  const router = useRouter();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.getFarmers();
      setFarmers(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load farmers');
      setFarmers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Appbar.Header>
        <Appbar.Content title="Farmers" />
      </Appbar.Header>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : error ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.error}>{error}</Text>
              <Button mode="outlined" onPress={load}>Retry</Button>
            </Card.Content>
          </Card>
        ) : farmers.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium">No farmers</Text>
              <Button mode="contained" onPress={() => router.push('/(app)/add-farmer')} style={styles.addBtn}>
                Add Farmer
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <List.Section>
            {farmers.map((farmer, i) => (
              <React.Fragment key={farmer.id}>
                <List.Item
                  title={farmer.display_name}
                  description="2 Farms"
                  left={() => <Avatar.Text size={40} label={getInitials(farmer.display_name)} />}
                  onPress={() => router.push({ pathname: '/(app)/farmers/[id]', params: { id: farmer.id } })}
                />
                {i < farmers.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))}
          </List.Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { paddingBottom: 24 },
  loader: { marginVertical: 24 },
  card: { margin: 16 },
  error: { marginBottom: 8 },
  addBtn: { marginTop: 12 },
});
