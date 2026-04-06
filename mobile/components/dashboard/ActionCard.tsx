import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';

export type ActionCardVariant = 'primary' | 'default';

type ActionCardProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: ActionCardVariant;
  /** Fixed width for horizontal scroll rows (buttons feel tappable, not stretched cards). */
  width?: number;
};

/**
 * Quick action control: flat outline (default) or filled primary — visually distinct from stat cards.
 */
export function ActionCard({
  icon,
  label,
  onPress,
  variant = 'default',
  width = 108,
}: ActionCardProps) {
  const isPrimary = variant === 'primary';
  const iconColor = isPrimary ? colors.white : colors.primary;
  const labelStyle = isPrimary ? styles.labelPrimary : styles.labelDefault;

  const dimStyle: ViewStyle = { width, minWidth: width };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        dimStyle,
        isPrimary ? styles.primary : styles.outline,
        pressed && (isPrimary ? styles.pressedPrimary : styles.pressedOutline),
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconBadge, isPrimary && styles.iconBadgePrimary]}>
        <MaterialCommunityIcons name={icon} size={26} color={iconColor} />
      </View>
      <Text variant="labelMedium" style={labelStyle} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: radius.card,
    minHeight: 100,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    // No drop shadow — reads as a control, not an elevated card
  },
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 0,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  pressedOutline: {
    backgroundColor: colors.gray100,
    borderColor: colors.primary,
  },
  pressedPrimary: {
    opacity: 0.92,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  iconBadgePrimary: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  labelPrimary: { color: colors.white, fontWeight: '700', textAlign: 'center' },
  labelDefault: { color: colors.gray900, fontWeight: '600', textAlign: 'center' },
});
