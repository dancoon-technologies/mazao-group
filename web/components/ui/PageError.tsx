"use client";

import { Alert } from "@mantine/core";

interface PageErrorProps {
  message: string;
  title?: string;
}

export function PageError({ message, title = "Error" }: PageErrorProps) {
  return (
    <Alert color="red" title={title} variant="light">
      {message}
    </Alert>
  );
}
