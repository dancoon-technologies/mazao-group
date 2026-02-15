import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function AppIndex() {
  const router = useRouter();
  const { isUnlocked } = useAuth();

  useEffect(() => {
    if (isUnlocked) {
      router.replace('/(app)/(tabs)');
    } else {
      router.replace('/(app)/unlock');
    }
  }, [isUnlocked, router]);

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
