import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { colors, radius, spacing } from '@/constants/theme';

type InfoCardProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
};

export function InfoCard({ title, subtitle, right, onPress }: InfoCardProps) {
  const content = (
    <Card style={styles.card} elevation={0}>
      <Card.Content style={right ? styles.contentRow : undefined}>
        <View style={styles.left}>
          <Text variant="titleSmall">{title}</Text>
          {subtitle != null && (
            <Text variant="bodySmall" style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </Card.Content>
    </Card>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.wrapper}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  card: { borderRadius: radius.lg },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flex: 1 },
  subtitle: { marginTop: 2, color: colors.gray700 },
  pressed: { opacity: 0.85 },
});
