import { cardShadow, cardStyle, colors, spacing } from '@/constants/theme';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

type ListItemRowProps = {
  avatarLetter: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
};

export const ListItemRow = memo(function ListItemRow({
  avatarLetter,
  title,
  subtitle,
  right,
  onPress,
}: ListItemRowProps) {
  const content = (
    <View style={styles.row}>
      <View style={styles.avatarCircle}>
        <Text variant="titleMedium" style={styles.avatarText}>
          {(avatarLetter || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.body}>
        <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle != null && (
          <Text variant="bodySmall" style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right != null ? <View style={styles.right}>{right}</View> : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.card}>{content}</View>;
});

const styles = StyleSheet.create({
  card: {
    ...cardStyle,
    ...cardShadow,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontWeight: '700', color: colors.gray700 },
  body: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  title: { fontWeight: '700', color: colors.gray900 },
  subtitle: { color: colors.gray700, marginTop: 2 },
  right: { marginLeft: spacing.sm },
  pressed: { opacity: 0.9 },
});
