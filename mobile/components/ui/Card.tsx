import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { colors, radius, spacing, shadows } from '@/constants/theme';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const wrapperStyle = [styles.card, shadows.card, style];

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [...wrapperStyle, pressed && styles.pressed]} onPress={onPress}>
        <View style={styles.content}>{children}</View>
      </Pressable>
    );
  }

  return <View style={wrapperStyle}><View style={styles.content}>{children}</View></View>;
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  content: {
    padding: spacing.md,
  },
  pressed: { opacity: 0.95 },
});
