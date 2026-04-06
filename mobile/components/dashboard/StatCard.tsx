import { cardShadow, colors, radius, spacing } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

type StatCardProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string | number;
  hint?: string;
};

/**
 * Read-only metric tile: elevated surface with border — distinct from tappable action controls.
 */
export function StatCard({ icon, label, value, hint }: StatCardProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconRow}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
        </View>
        <Text variant="labelMedium" style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text variant="headlineMedium" style={styles.value}>
        {value}
      </Text>
      {hint ? (
        <Text variant="bodySmall" style={styles.hint} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '47%',
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...cardShadow,
    elevation: 2,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.gray700, flex: 1, fontWeight: '600' },
  value: { fontWeight: '800', color: colors.gray900, marginTop: 2 },
  hint: { color: colors.gray500, marginTop: 4, lineHeight: 18 },
});
