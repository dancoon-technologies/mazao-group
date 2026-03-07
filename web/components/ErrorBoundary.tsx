"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Text, Title } from "@mantine/core";
import { ROUTES } from "@/lib/constants";

interface Props {
  children: ReactNode;
  /** Optional fallback UI. If not provided, default message and link are shown. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches React errors in the tree and shows a fallback UI.
 * Enterprise: prevent white screen, allow recovery or navigation.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught:", error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Box p="xl" maw={500} mx="auto">
          <Title order={3} mb="sm">
            Something went wrong
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            An unexpected error occurred. Please try again or return to the dashboard.
          </Text>
          <Button component="a" href={ROUTES.DASHBOARD} variant="light">
            Go to dashboard
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
