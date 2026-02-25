import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getPendingSyncCount, syncWithServer } from '@/lib/syncWithServer';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

function InfoRow({
  icon,
  iconColor,
  label,
  value,
  valueComponent,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  label: string;
  value?: string | null;
  valueComponent?: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIconWrap, { backgroundColor: `${iconColor}18` }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.infoContent}>
        <Text variant="labelSmall" style={styles.infoLabel}>
          {label}
        </Text>
        {valueComponent != null ? (
          valueComponent
        ) : (
          <Text variant="bodyLarge" style={styles.infoValue} numberOfLines={1}>
            {value ?? '—'}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { email, displayName, department, region, roleDisplay, logout } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? false));
    return () => sub();
  }, []);

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

  const name = (displayName?.trim() || email || 'Field officer').trim();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Account and settings
          </Text>
        </View>

        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.onlineCardContent}>
            <View style={styles.onlineLeft}>
              <View style={styles.onlineIconWrap}>
                <MaterialCommunityIcons
                  name="wifi"
                  size={28}
                  color={isOnline === true ? colors.primary : colors.gray500}
                />
              </View>
              <View>
                <Text variant="titleMedium" style={styles.onlineTitle}>
                  {isOnline === true ? 'Online' : isOnline === false ? 'Offline' : 'Checking…'}
                </Text>
                <Text variant="bodySmall" style={styles.onlineSubtitle}>
                  {isOnline === true ? 'Connected to server' : 'No connection'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Account Information
        </Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.infoCardContent}>
            <InfoRow
              icon="account-outline"
              iconColor={colors.primary}
              label="Name"
              value={name}
            />
            <Divider style={styles.divider} />
            <InfoRow
              icon="email-outline"
              iconColor={colors.info}
              label="Email"
              value={email ?? undefined}
            />
            <Divider style={styles.divider} />
            <InfoRow
              icon="domain"
              iconColor="#7C3AED"
              label="Department"
              value={department ?? undefined}
            />
            <Divider style={styles.divider} />
            <InfoRow
              icon="map-marker-outline"
              iconColor={colors.accent}
              label="Region"
              value={region ?? undefined}
            />
            <Divider style={styles.divider} />
            <InfoRow
              icon="account-badge-outline"
              iconColor={colors.primary}
              label="Role"
              valueComponent={
                <View style={styles.roleBadge}>
                  <Text variant="labelMedium" style={styles.roleBadgeText}>
                    {roleDisplay || 'Field Officer'}
                  </Text>
                </View>
              }
            />
          </Card.Content>
        </Card>

        {pendingCount > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text variant="bodyMedium">{pendingCount} visit(s) waiting to sync</Text>
              <Button
                mode="contained"
                onPress={handleSync}
                loading={syncing}
                disabled={syncing}
                style={styles.syncBtn}
              >
                Sync now
              </Button>
            </Card.Content>
          </Card>
        )}

        <View style={styles.logoutWrap}>
          <Button mode="outlined" onPress={handleLogout} style={styles.logout} textColor={colors.error}>
            Sign out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray100 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 80 },
  header: { marginBottom: spacing.xl },
  title: { fontWeight: '700', color: colors.gray900 },
  subtitle: { color: colors.gray700, marginTop: 4 },
  card: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  onlineCardContent: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
  onlineLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  onlineIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  onlineTitle: { fontWeight: '700', color: colors.gray900 },
  onlineSubtitle: { color: colors.gray700, marginTop: 2 },
  sectionTitle: {
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  infoCardContent: { paddingVertical: 0, paddingHorizontal: spacing.lg },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: { color: colors.gray700, marginBottom: 2 },
  infoValue: { fontWeight: '600', color: colors.gray900 },
  divider: { marginLeft: 52 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  roleBadgeText: { fontWeight: '600', color: colors.gray700 },
  syncBtn: { marginTop: spacing.sm },
  logoutWrap: { marginTop: spacing.xl },
  logout: { borderColor: colors.error, color: colors.error },
});
