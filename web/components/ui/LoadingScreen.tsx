"use client";

import { Center, Loader, Stack, Text } from "@mantine/core";
import { LOADER_COLOR } from "@/lib/constants";

interface LoadingScreenProps {
  message?: string;
  fullViewport?: boolean;
}

export function LoadingScreen({
  message = "Loading…",
  fullViewport = true,
}: LoadingScreenProps) {
  return (
    <Center py={fullViewport ? undefined : "xl"} h={fullViewport ? "100vh" : undefined}>
      <Stack align="center" gap="md">
        <Loader size="sm" color={LOADER_COLOR} />
        <Text size="sm" c="dimmed">
          {message}
        </Text>
      </Stack>
    </Center>
  );
}
