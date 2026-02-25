import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const LOGIN_BG = '#F2FFF2';
const CARD_RADIUS = 20;

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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.logoWrap}>
              <MaterialCommunityIcons
                name="check"
                size={40}
                color={colors.white}
              />
            </View>
            <Text variant="headlineSmall" style={styles.brand}>
              Mazao Group
            </Text>
            <Text variant="bodyMedium" style={styles.portalTitle}>
              Field Officer Portal
            </Text>

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="officer@mazao.com"
              placeholderTextColor={colors.gray500}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              mode="outlined"
              outlineColor={colors.gray200}
              activeOutlineColor={colors.primary}
              textColor={colors.gray900}
              style={styles.input}
              contentStyle={styles.inputContent}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.gray500}
              secureTextEntry
              autoComplete="password"
              mode="outlined"
              outlineColor={colors.gray200}
              activeOutlineColor={colors.primary}
              textColor={colors.gray900}
              style={styles.input}
              contentStyle={styles.inputContent}
            />

            {loading ? (
              <ActivityIndicator size="small" style={styles.loader} color={colors.primary} />
            ) : (
              <Button
                mode="contained"
                onPress={handleLogin}
                disabled={loading}
                style={styles.signInBtn}
                contentStyle={styles.signInBtnContent}
                labelStyle={styles.signInBtnLabel}
              >
                Sign In
              </Button>
            )}
          </View>
        </ScrollView>
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
  safe: { flex: 1, backgroundColor: LOGIN_BG },
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: CARD_RADIUS,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brand: {
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  portalTitle: {
    color: colors.gray700,
    marginBottom: spacing.xl,
  },
  input: {
    marginBottom: spacing.lg,
    backgroundColor: colors.white,
    width: '100%',
  },
  inputContent: {
    borderRadius: radius.lg,
  },
  loader: { marginTop: spacing.lg },
  signInBtn: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    width: '100%',
    backgroundColor: colors.primary,
  },
  signInBtnContent: {
    paddingVertical: 6,
  },
  signInBtnLabel: {
    fontWeight: '700',
    fontSize: 16,
  },
});
