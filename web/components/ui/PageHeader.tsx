"use client";

import { Badge, Box, Group, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export interface PageHeaderBadge {
  label: string;
  color?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badges?: PageHeaderBadge[];
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, badges, action }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="md" mb="md">
      <Box>
        <Group gap="sm" align="center" wrap="wrap">
          <Title order={1} size="h2" fw={600}>
            {title}
          </Title>
          {badges?.map((b) => (
            <Badge key={b.label} color={b.color ?? "gray"} variant="light" size="sm">
              {b.label}
            </Badge>
          ))}
        </Group>
        {subtitle != null && (
          <Text size="sm" c="dimmed" mt={4}>
            {subtitle}
          </Text>
        )}
      </Box>
      {action}
    </Group>
  );
}
