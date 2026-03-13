"use client";

import { Alert, Button } from "@mantine/core";

interface PageErrorProps {
  message: string;
  title?: string;
  onRetry?: () => void | Promise<void>;
}

export function PageError({ message, title = "Something went wrong", onRetry }: PageErrorProps) {
  return (
    <Alert color="red" title={title} variant="light" radius="md">
      {message}
      {onRetry && (
        <Button variant="light" color="red" size="xs" mt="sm" onClick={() => void onRetry()}>
          Retry
        </Button>
      )}
    </Alert>
  );
}
