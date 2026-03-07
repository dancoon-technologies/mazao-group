"use client";

import { Alert } from "@mantine/core";

interface PageErrorProps {
  message: string;
  title?: string;
}

export function PageError({ message, title = "Something went wrong" }: PageErrorProps) {
  return (
    <Alert color="red" title={title} variant="light" radius="md">
      {message}
    </Alert>
  );
}
