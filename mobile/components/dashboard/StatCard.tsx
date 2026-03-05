import { colors, cardShadow, cardStyle, spacing } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

type StatCardProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string | number;
};

export function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card style={[cardStyle, cardShadow, styles.card]} elevation={2}>
      <Card.Content style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name={icon} size={22} color={colors.gray700} />
          <Text variant="labelMedium" style={styles.label}>
            {label}
          </Text>
        </View>
        <Text variant="headlineMedium" style={styles.value}>
          {value}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  iconContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: {
    width: '47%',
    minWidth: 0,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  content: { alignItems: 'flex-start', paddingHorizontal: 0, paddingVertical: 0 },
  label: { color: colors.gray700, marginTop: 4 },
  value: { fontWeight: '700', color: colors.gray900, marginTop: 2 },
});
