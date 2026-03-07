import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function IndexScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const navigate = async () => {
      await SplashScreen.hideAsync();
      if (!isAuthenticated) {
        router.replace('/login');
        return;
      }
      if (mustChangePassword) {
        router.replace('/change-password');
      } else {
        router.replace('/(app)');
      }
    };
    navigate();
  }, [isAuthenticated, isLoading, mustChangePassword, router]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
