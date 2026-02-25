import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows, typography } from '@/constants/theme';

const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  index: 'home',
  visits: 'format-list-bulleted',
  record: 'plus-circle',
  farmers: 'account-group',
  profile: 'account',
};

export default function AppTabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => {
        const isRecord = route.name === 'record';
        const bottomInset = insets.bottom;
        return {
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.gray500,
          headerShown: true,
          headerTitle: getHeaderTitle(route.name),
          headerTitleStyle: {
            fontSize: typography.headingL.fontSize,
            fontWeight: typography.headingL.fontWeight,
          },
          headerStyle: {
            backgroundColor: colors.white,
            borderBottomColor: colors.gray200,
            borderBottomWidth: 0.5,
          },
          headerShadowVisible: false,
          headerBackground: () => null,
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
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.index} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Visits',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.visits} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="farmers"
        options={{
          title: 'Farmers',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.farmers} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={TAB_ICONS.profile} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function getHeaderTitle(name: string) {
  switch (name) {
    case 'index':
      return 'Welcome Back';
    case 'profile':
      return 'Profile';
    case 'visits':
      return 'My Visits';
    case 'record':
      return 'Record Visit';
    case 'farmers':
      return 'Farmers';
    case 'history':
      return 'Visit History';
    default:
      return '';
  }
}
