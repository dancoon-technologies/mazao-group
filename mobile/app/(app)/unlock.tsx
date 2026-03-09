import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useAppRefresh } from '@/contexts/AppRefreshContext';
import { useAuth } from '@/contexts/AuthContext';

export default function UnlockScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { triggerRefresh } = useAppRefresh();
  const { setUnlocked, logout } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const authenticate = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setError('Biometrics not available. Use Sign out and sign in with password.');
        setLoading(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Mazao',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        await setUnlocked(true);
        triggerRefresh();
        router.replace('/(app)/(tabs)');
      } else {
        if (result.error === 'user_cancel') setError('Unlock cancelled.');
        else setError(result.error ?? 'Authentication failed.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed');
    } finally {
      setLoading(false);
    }
  }, [setUnlocked, router]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={styles.title}>
        Unlock app
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Use fingerprint or Face ID to continue
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={authenticate} loading={loading} style={styles.button}>
        Unlock
      </Button>
      <Button mode="text" onPress={handleLogout} style={styles.button}>
        Sign out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 24,
    opacity: 0.8,
  },
  error: {
    color: '#b00020',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    minWidth: 200,
  },
});
