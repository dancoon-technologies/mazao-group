import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  rightLabel?: string;
  onRightPress?: () => void;
  /** Short line under the title for clearer hierarchy */
  showAccent?: boolean;
};

export function SectionHeader({ title, rightLabel, onRightPress, showAccent = true }: SectionHeaderProps) {
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <View style={styles.titleWrap}>
          {showAccent ? <View style={styles.accent} /> : null}
          <Text variant="titleMedium" style={styles.title}>
            {title}
          </Text>
        </View>
        {rightLabel != null && (
          <Text variant="labelLarge" style={styles.rightLink} onPress={onRightPress}>
            {rightLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  accent: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  title: { fontWeight: '800', color: colors.gray900, flex: 1 },
  rightLink: { color: colors.primary, fontWeight: '700' },
});
