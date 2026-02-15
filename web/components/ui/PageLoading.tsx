"use client";

import { Center, Loader, Stack, Text } from "@mantine/core";
import { LOADER_COLOR } from "@/lib/constants";

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = "Loading…" }: PageLoadingProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="md">
        <Loader size="sm" color={LOADER_COLOR} />
        <Text size="sm" c="dimmed">
          {message}
        </Text>
      </Stack>
    </Center>
  );
}
