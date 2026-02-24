import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Surface,
  Text,
  TextInput,
  Button,
  Snackbar,
  ActivityIndicator,
} from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      setSnackbarVisible(true);
      return;
    }
    setLoading(true);
    try {
      const { mustChangePassword } = await login(email.trim(), password);
      if (mustChangePassword) {
        router.replace('/change-password');
      } else {
        router.replace('/(app)');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Surface style={styles.surface} elevation={0}>
          <Text variant="headlineMedium">Mazao Field App</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Extension officer sign in
          </Text>

          <View style={styles.spacer} />

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            mode="outlined"
            style={styles.input}
          />

          {loading ? (
            <ActivityIndicator size="small" style={styles.loader} />
          ) : (
            <Button
              mode="contained"
              onPress={handleLogin}
              disabled={loading}
              style={styles.button}
              accessibilityLabel="Login"
            >
              Login
            </Button>
          )}

          <Text variant="bodySmall" style={styles.footer}>
            Contact your supervisor if you need access
          </Text>
        </Surface>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        action={{ label: 'Dismiss', onPress: () => setSnackbarVisible(false) }}
      >
        {error}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  surface: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  subtitle: { marginTop: 4, marginBottom: 24 },
  spacer: { height: 40 },
  input: { marginBottom: 16 },
  loader: { marginTop: 24 },
  button: { marginTop: 24 },
  footer: {
    textAlign: 'center',
    marginTop: 32,
    opacity: 0.7,
  },
});
