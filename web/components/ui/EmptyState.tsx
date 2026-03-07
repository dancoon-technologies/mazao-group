"use client";

import { Center, Text } from "@mantine/core";

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <Center py="xl" px="md">
      <Text size="sm" c="dimmed" ta="center" maw={360}>
        {message}
      </Text>
    </Center>
  );
}
