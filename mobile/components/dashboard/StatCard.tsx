import { colors, radius } from '@/constants/theme';
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
    <Card style={styles.card}>
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
  iconContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, },
  card: {
    width: '47%',
    minWidth: 0,
    borderRadius: radius.lg,
  },
  content: { alignItems: 'flex-start' },
  label: { color: colors.gray700, marginTop: 4 },
  value: { fontWeight: '700', color: colors.gray900, marginTop: 2 },
});
