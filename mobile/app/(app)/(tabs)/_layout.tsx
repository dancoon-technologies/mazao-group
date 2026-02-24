import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors, spacing } from '@/constants/theme';

export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        headerShown: true,
        headerTitle: getHeaderTitle(route.name),
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '600',
        },
        headerShadowVisible: false,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      })}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Visits',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function getHeaderTitle(name: string) {
  switch (name) {
    case 'index':
      return 'Dashboard';
    case 'profile':
      return 'Profile';
    case 'visits':
      return 'Visits';
    case 'history':
      return 'History';
    default:
      return '';
  }
}