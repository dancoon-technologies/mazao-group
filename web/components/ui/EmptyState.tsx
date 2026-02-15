"use client";

import { Center, Text } from "@mantine/core";

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <Center py="xl">
      <Text size="sm" c="dimmed">
        {message}
      </Text>
    </Center>
  );
}
