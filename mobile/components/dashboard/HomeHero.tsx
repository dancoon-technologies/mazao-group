import { colors, radius, spacing } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

type HomeHeroProps = {
  greeting: string;
  displayName: string;
  departmentLabel?: string | null;
  syncLabel: string | null;
  onPressNotifications: () => void;
};

/**
 * Full-width gradient header for the home dashboard: greeting, identity, sync, notifications.
 */
export function HomeHero({
  greeting,
  displayName,
  departmentLabel,
  syncLabel,
  onPressNotifications,
}: HomeHeroProps) {
  return (
    <LinearGradient
      colors={['#0F3D1F', '#14532D', '#166534', '#1B8F3A']}
      locations={[0, 0.35, 0.72, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.blobA} pointerEvents="none" />
      <View style={styles.blobB} pointerEvents="none" />
      <View style={styles.blobC} pointerEvents="none" />

      <View style={styles.topRow}>
        <View style={styles.copyBlock}>
          <Text variant="labelLarge" style={styles.greeting}>
            {greeting}
          </Text>
          <Text variant="headlineMedium" style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          <View style={styles.metaRow}>
            {departmentLabel ? (
              <View style={styles.pill}>
                <MaterialCommunityIcons name="office-building-outline" size={15} color="rgba(255,255,255,0.92)" />
                <Text style={styles.pillText} numberOfLines={1}>
                  {departmentLabel}
                </Text>
              </View>
            ) : null}
            {syncLabel ? (
              <View style={styles.pillMuted}>
                <MaterialCommunityIcons name="cloud-sync-outline" size={15} color="rgba(255,255,255,0.88)" />
                <Text style={styles.pillTextMuted} numberOfLines={1}>
                  {syncLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={onPressNotifications}
          style={({ pressed }) => [styles.bellFab, pressed && styles.bellFabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <MaterialCommunityIcons name="bell-outline" size={26} color={colors.white} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.sm,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  blobA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -80,
    right: -60,
  },
  blobB: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -20,
    left: -50,
  },
  blobC: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: 40,
    left: '12%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  copyBlock: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  name: {
    color: colors.white,
    fontWeight: '700',
    marginTop: spacing.xs,
    lineHeight: 34,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    maxWidth: '100%',
  },
  pillText: {
    color: 'rgba(255,255,255,0.96)',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  pillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  pillTextMuted: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '500',
  },
  bellFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bellFabPressed: {
    opacity: 0.88,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});
