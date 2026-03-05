import { StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { spacing } from '@/constants/theme';

type EmptyStateCardProps = {
  message: string;
};

export function EmptyStateCard({ message }: EmptyStateCardProps) {
  return (
    <Card style={styles.card} elevation={0}>
      <Card.Content>
        <Text variant="bodyMedium">{message}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
});
