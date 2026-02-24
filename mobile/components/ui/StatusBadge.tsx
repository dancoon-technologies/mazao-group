import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, radius, spacing, typography } from '@/constants/theme';

export type BadgeStatus = 'verified' | 'pending' | 'rejected' | 'proposed' | 'accepted';

const statusConfig: Record<
  BadgeStatus,
  { bg: string; text: string; label: string }
> = {
  verified: { bg: colors.successLight, text: colors.success, label: 'Verified' },
  accepted: { bg: colors.successLight, text: colors.success, label: 'Accepted' },
  pending: { bg: colors.warningLight, text: colors.warning, label: 'Pending' },
  proposed: { bg: colors.warningLight, text: colors.warning, label: 'Proposed' },
  rejected: { bg: colors.errorLight, text: colors.error, label: 'Rejected' },
};

export interface StatusBadgeProps {
  status: BadgeStatus | string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const key = (status?.toLowerCase?.() || 'pending') as BadgeStatus;
  const config = statusConfig[key] ?? statusConfig.pending;
  const displayLabel = label ?? config.label;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text variant="labelMedium" style={[styles.text, { color: config.text }]}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
});
