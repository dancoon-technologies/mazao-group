import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  rightLabel?: string;
  onRightPress?: () => void;
};

export function SectionHeader({ title, rightLabel, onRightPress }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {rightLabel != null && (
        <Text
          variant="labelLarge"
          style={styles.rightLink}
          onPress={onRightPress}
        >
          {rightLabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { fontWeight: '700', color: colors.gray900 },
  rightLink: { color: colors.primary, fontWeight: '600' },
});
