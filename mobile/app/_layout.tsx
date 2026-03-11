import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

import { hasValidApiBase } from '@/constants/config';
import { colors } from '@/constants/theme';
import { AuthProvider } from '@/contexts/AuthContext';
// Initialize Legend State persistence (AsyncStorage) before any screens load
import '@/store/observable';
import { paperTheme } from '@/lib/paper-theme';

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

export default function RootLayout() {
  if (!hasValidApiBase) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <ConfigErrorScreen />
          <StatusBar style="light" backgroundColor={colors.primary} />
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
        <StatusBar style="light" backgroundColor={colors.primary} />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
