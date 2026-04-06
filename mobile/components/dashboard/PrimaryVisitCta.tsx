import { colors, radius, spacing } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

type PrimaryVisitCtaProps = {
  onPress: () => void;
};

/**
 * Prominent full-width primary action — reads as a button, not a stat card.
 */
export function PrimaryVisitCta({ onPress }: PrimaryVisitCtaProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Record a visit"
    >
      <View style={styles.inner}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="camera" size={26} color={colors.white} />
        </View>
        <View style={styles.textCol}>
          <Text variant="titleMedium" style={styles.title}>
            Record a visit
          </Text>
          <Text variant="bodySmall" style={styles.sub}>
            Capture photos & GPS for your field work
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={28} color="rgba(255,255,255,0.85)" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card + 2,
    backgroundColor: colors.primary,
    marginBottom: spacing.xl,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.white,
    fontWeight: '700',
  },
  sub: {
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
  },
});
