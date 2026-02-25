import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';

export type ActionCardVariant = 'primary' | 'default';

type ActionCardProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: ActionCardVariant;
};

export function ActionCard({
  icon,
  label,
  onPress,
  variant = 'default',
}: ActionCardProps) {
  const isPrimary = variant === 'primary';
  const iconColor = isPrimary ? '#fff' : colors.gray900;
  const labelStyle = isPrimary ? styles.labelPrimary : styles.labelDefault;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isPrimary && styles.cardPrimary,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon} size={28} color={iconColor} />
      <Text variant="labelLarge" style={labelStyle}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  cardPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  labelPrimary: { color: '#fff', marginTop: 6, fontWeight: '600' },
  labelDefault: { color: colors.gray900, marginTop: 6, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
