import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { Tabs, useNavigation, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  index: 'home',
  visits: 'format-list-bulleted',
  schedules: 'calendar',
  record: 'plus-circle',
  farmers: 'account-group',
  stockists: 'store-outline',
  menu: 'menu',
  maintenance: 'tools',
  tracking: 'map-marker-path',
  profile: 'account',
};

export default function AppTabsLayout() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const isSupervisor = role === 'supervisor';

  const openDrawer = () => {
    const parent = navigation.getParent();
    if (parent) parent.dispatch(DrawerActions.openDrawer());
  };

  return (
    <Tabs
      screenOptions={({ route }) => {
        const isRecord = route.name === 'record';
        const bottomInset = insets.bottom;
        return {
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.gray500,
          headerShown: false,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
          tabBarStyle: {
            height: 88 + bottomInset,
            paddingTop: 8,
            paddingBottom: bottomInset,
            backgroundColor: colors.white,
            borderTopColor: colors.gray200,
          },
          tabBarShowLabel: true,
          tabBarButton: isRecord
            ? (props) => {
              const { ref: _ref, ...rest } = props as { ref?: unknown;[k: string]: unknown };
              return (
                <Pressable
                  {...rest}
                  onPress={() => router.push('/(app)/record-visit')}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginTop: -24,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View
                    style={[
                      {
                        width: 64,
                        height: 64,
                        borderRadius: 24,
                        backgroundColor: colors.primary,
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                      shadows.fab,
                    ]}
                  >
                    <MaterialCommunityIcons name="plus" size={28} color={colors.white} />
                  </View>
                  <Text style={{ marginTop: 4, fontSize: 12, color: colors.gray700 }}>Record</Text>
                </Pressable>
              );
            }
            : undefined,
        };
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.index} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          headerShown: false,
          title: 'Visits',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.visits} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedules"
        options={{
          headerShown: false,
          title: 'Schedules',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.schedules} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          headerShown: false,
          title: 'Track team',
          href: null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.tracking} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          headerShown: false,
          title: 'Record',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="farmers"
        options={{
          headerShown: false,
          title: 'Farmers',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.farmers} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stockists"
        options={{
          headerShown: false,
          title: 'Stockists',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.stockists} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          headerShown: false,
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.menu} size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            openDrawer();
          },
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          headerShown: false,
          title: 'Maintenance',
          href: null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.maintenance} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          headerShown: false,
          title: 'History',
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          title: 'Profile',
          href: null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.profile} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
