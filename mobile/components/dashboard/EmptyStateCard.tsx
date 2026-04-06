import { colors, radius, spacing } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

type EmptyStateCardProps = {
  message: string;
};

/**
 * Non-interactive placeholder: dashed border, flat — not confused with buttons.
 */
export function EmptyStateCard({ message }: EmptyStateCardProps) {
  return (
    <View style={styles.card}>
      <MaterialCommunityIcons name="calendar-blank-outline" size={28} color={colors.gray500} style={styles.icon} />
      <Text variant="bodyMedium" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  icon: { marginBottom: spacing.sm, opacity: 0.85 },
  text: { color: colors.gray700, textAlign: 'center', lineHeight: 22 },
});
