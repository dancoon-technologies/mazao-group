import { StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { cardShadow, cardStyle, spacing } from '@/constants/theme';

type EmptyStateCardProps = {
  message: string;
};

export function EmptyStateCard({ message }: EmptyStateCardProps) {
  return (
    <Card style={[cardStyle, cardShadow, styles.card]} elevation={2}>
      <Card.Content style={styles.content}>
        <Text variant="bodyMedium">{message}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  content: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
});
