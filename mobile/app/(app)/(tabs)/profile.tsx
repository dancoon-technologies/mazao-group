import { useAuth } from '@/contexts/AuthContext';
import { syncWithServer, getPendingSyncCount } from '@/lib/syncWithServer';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Button, Text, Card } from 'react-native-paper';

export default function ProfileScreen() {
  const router = useRouter();
  const { email, logout } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    const n = await getPendingSyncCount();
    setPendingCount(n);
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncWithServer();
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Account</Text>
          <Text variant="bodyMedium" style={styles.email}>
            {email ?? 'Field officer'}
          </Text>
        </Card.Content>
      </Card>

      {pendingCount > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium">{pendingCount} visit(s) waiting to sync</Text>
            <Button mode="contained" onPress={handleSync} loading={syncing} disabled={syncing} style={styles.syncBtn}>
              Sync now
            </Button>
          </Card.Content>
        </Card>
      )}

      <List.Section>
        <List.Subheader>App</List.Subheader>
        <List.Item
          title="Record visit"
          description="Record a visit with GPS and photo"
          left={(props) => <List.Icon {...props} icon="camera" />}
          onPress={() => router.push('/(app)/record-visit')}
        />
        <List.Item
          title="Add farmer"
          description="Register a new farmer and farm"
          left={(props) => <List.Icon {...props} icon="account-plus" />}
          onPress={() => router.push('/(app)/add-farmer')}
        />
        <List.Item
          title="Propose schedule"
          description="Request schedule approval from supervisor"
          left={(props) => <List.Icon {...props} icon="calendar-plus" />}
          onPress={() => router.push('/(app)/propose-schedule')}
        />
      </List.Section>

      <View style={styles.logoutWrap}>
        <Button mode="outlined" onPress={handleLogout} style={styles.logout}>
          Sign out
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { marginBottom: 16, borderRadius: 8 },
  email: { marginTop: 4, opacity: 0.8 },
  syncBtn: { marginTop: 8 },
  logoutWrap: { marginTop: 24 },
  logout: { borderColor: '#b00020' },
});
