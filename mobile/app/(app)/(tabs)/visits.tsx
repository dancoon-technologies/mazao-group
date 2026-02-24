import { api, type Visit } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Appbar,
  Text,
  Searchbar,
  Chip,
  Card,
  Badge,
  Divider,
  ActivityIndicator,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type FilterStatus = 'all' | 'verified' | 'rejected' | 'today';

export default function VisitsScreen() {
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.getVisits();
      setVisits(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visits');
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = visits;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.farmer_display_name?.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q) ||
          v.farmer?.toLowerCase().includes(q) ||
          v.notes?.toLowerCase().includes(q) ||
          v.activity_type?.toLowerCase().includes(q)
      );
    }
    if (filter === 'verified') {
      list = list.filter((v) => (v.verification_status || '').toLowerCase() === 'verified');
    } else if (filter === 'rejected') {
      list = list.filter((v) => (v.verification_status || '').toLowerCase() === 'rejected');
    } else if (filter === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter((v) => (v.created_at || '').slice(0, 10) === today);
    }
    return list;
  }, [visits, search, filter]);

  const statusLabel = (v: Visit) => {
    const s = (v.verification_status || '').toLowerCase();
    if (s === 'verified') return 'Verified';
    if (s === 'rejected') return 'Rejected';
    return 'Pending';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Searchbar
          placeholder="Search visits"
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
        />
        <View style={styles.chipRow}>
          <Chip
            selected={filter === 'verified'}
            onPress={() => setFilter(filter === 'verified' ? 'all' : 'verified')}
            style={styles.chip}
          >
            Verified
          </Chip>
          <Chip
            selected={filter === 'rejected'}
            onPress={() => setFilter(filter === 'rejected' ? 'all' : 'rejected')}
            style={styles.chip}
          >
            Rejected
          </Chip>
          <Chip
            selected={filter === 'today'}
            onPress={() => setFilter(filter === 'today' ? 'all' : 'today')}
            style={styles.chip}
          >
            Today
          </Chip>
        </View>
        <Divider style={styles.divider} />

        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : error ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.error}>{error}</Text>
              <Button mode="outlined" onPress={load} style={styles.retryBtn}>
                Retry
              </Button>
            </Card.Content>
          </Card>
        ) : filtered.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium">No visits found</Text>
            </Card.Content>
          </Card>
        ) : (
          filtered.map((v) => (
            <Card key={v.id} style={styles.card} onPress={() => router.push({ pathname: '/(app)/visits/[id]', params: { id: v.id } })}>
              <Card.Title
                title={v.farmer_display_name ?? v.farmer ?? 'Unknown'}
                subtitle={v.farm_display_name ?? v.farm ?? '—'}
                right={() => <Badge style={styles.badge}>{statusLabel(v)}</Badge>}
                rightStyle={styles.badgeWrap}
              />
              <Card.Content>
                <Text variant="bodyMedium">{v.activity_type || 'Visit'}</Text>
                <Text variant="bodySmall" style={styles.date}>{formatDate(v.created_at)}</Text>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  searchbar: { marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { marginRight: 0 },
  divider: { marginVertical: 8 },
  loader: { marginVertical: 24 },
  card: { marginVertical: 6 },
  badgeWrap: { alignSelf: 'center', marginRight: 16 },
  badge: {},
  date: { marginTop: 4, opacity: 0.8 },
  error: { marginBottom: 8 },
  retryBtn: { marginTop: 8 },
});
