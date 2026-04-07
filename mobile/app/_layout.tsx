import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

import { hasValidApiBase } from '@/constants/config';
import { AuthProvider } from '@/contexts/AuthContext';
import '@/lib/sentry';
// Initialize Legend State persistence (AsyncStorage) before any screens load
import '@/store/observable';
import { paperTheme } from '@/lib/paper-theme';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://1d644c4c976e425cec4b7b3c9c382d85@o4511144680554496.ingest.us.sentry.io/4511144702246912',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Keep native splash visible until we hide it after auth is ready
SplashScreen.preventAutoHideAsync();

function ConfigErrorScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 16, textAlign: 'center' }}>
        EXPO_PUBLIC_API_URL is not set. Set it in .env (or app config for production builds) and restart the app.
      </Text>
    </View>
  );
}

export default Sentry.wrap(function RootLayout() {
  if (!hasValidApiBase) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <ConfigErrorScreen />
          <StatusBar style="dark" />
        </PaperProvider>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="change-password" options={{ title: 'Set new password' }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="dark" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
});
