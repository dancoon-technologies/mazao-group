import { api, type Farmer, type Schedule } from '@/lib/api';
import { router, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Card, FAB, ProgressBar, Text } from 'react-native-paper';

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function HomeScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await api.getSchedules();
      setSchedules(s);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
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

  // Dashboard stats
  const totalVisits = schedules.length;
  const pendingSchedules = schedules.length;
  const visitedFarmers = schedules.filter((s) => s.id !== null).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <FAB icon="loading" loading={true} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Welcome Card */}
      <WelcomeCard totalVisits={totalVisits} pendingSchedules={pendingSchedules} />

      {/* Quick Actions */}
      <QuickActions pendingSchedules={pendingSchedules} totalVisits={totalVisits} />

      {/* Overview */}
      <Overview totalVisits={totalVisits} visitedFarmers={visitedFarmers} pendingFarmers={pendingSchedules} />
    </ScrollView>
  );
}

const WelcomeCard = ({ totalVisits, pendingSchedules }: { totalVisits: number, pendingSchedules: number }) => {
  return (<Card style={styles.welcomeCard}>
    <Card.Content>
      <View style={styles.welcomeHeader}>
        <View>
          <Text variant="titleMedium" >Welcome Back!</Text>
          <Text variant="bodySmall" >
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <Avatar.Icon size={40} icon="account" />
      </View>
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="bodySmall">This Week</Text>
            <Text variant="titleMedium" >{totalVisits}</Text>
            <Text variant="bodySmall" >Visits</Text>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="bodySmall" >Pending</Text>
            <Text variant="titleMedium" >{pendingSchedules}</Text>
            <Text variant="bodySmall" >Schedules</Text>
          </Card.Content>
        </Card>
      </View>
    </Card.Content>
  </Card>)
}

const QuickActions = ({ pendingSchedules, totalVisits }: { pendingSchedules: number, totalVisits: number }) => {
  return (
    <>
      <Text variant="titleMedium" style={{ marginTop: 24, marginBottom: 8 }}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <Card style={styles.quickCard} onPress={() => router.push('/(app)/(tabs)/visits')}>
          <Card.Content style={styles.quickCardContent}>
            <Avatar.Icon icon="account-group" size={36} style={{ backgroundColor: '#e0f2f1' }} />
            <View>
              <Text variant="titleSmall">Schedule List</Text>
              <Text variant="bodySmall">{pendingSchedules} schedules</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.quickCard} onPress={() => router.push('/(app)/(tabs)/profile')}>
          <Card.Content style={styles.quickCardContent}>
            <Avatar.Icon icon="history" size={36} style={{ backgroundColor: '#e3f2fd' }} />
            <View>
              <Text variant="titleSmall">History</Text>
              <Text variant="bodySmall">{totalVisits} visits</Text>
            </View>
          </Card.Content>
        </Card>
      </View>
    </>
  )
}

const Overview = ({ totalVisits, visitedFarmers, pendingFarmers }: { totalVisits: number, visitedFarmers: number, pendingFarmers: number }) => {
  const progress = pendingFarmers ? visitedFarmers / pendingFarmers : 0;
  return (
    <>
      <Text variant="titleMedium" style={{ marginTop: 24, marginBottom: 8 }}>Overview</Text>
      <Card style={styles.overviewCard}>
        <Card.Content>
          <Text variant="bodySmall">Total Visits</Text>
          <Text variant="titleMedium">{totalVisits}</Text>
          <Text variant="bodySmall" style={{ color: 'green' }}>↑</Text>
        </Card.Content>
      </Card>
      <Card style={styles.overviewCard}>
        <Card.Content>
          <Text variant="bodySmall">Farmers Visited</Text>
          <Text variant="titleMedium">{visitedFarmers} / {pendingFarmers}</Text>
          <ProgressBar progress={progress} style={{ marginTop: 4 }} />
        </Card.Content>
      </Card>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeCard: {
    backgroundColor: '#2e7d32', // TODO: Change to theme color
    borderRadius: 12,
    padding: 2,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    marginRight: 20,
    borderRadius: 12,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickCard: {
    flex: 1,
    marginRight: 8,
    borderRadius: 8,
  },
  quickCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overviewCard: {
    marginTop: 8,
    borderRadius: 8,
    padding: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
});
