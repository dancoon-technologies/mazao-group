"use client";

import { MantineProvider, createTheme, rem } from "@mantine/core";
import { Toaster } from "sonner";

const theme = createTheme({
  primaryColor: "green",
  defaultRadius: "md",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  headings: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    fontWeight: "600",
    sizes: {
      h1: { fontSize: rem(28), lineHeight: "1.2" },
      h2: { fontSize: rem(22), lineHeight: "1.3" },
      h3: { fontSize: rem(18), lineHeight: "1.4" },
    },
  },
  defaultGradient: {
    from: "green.6",
    to: "teal.6",
    deg: 135,
  },
  components: {
    Paper: {
      defaultProps: {
        radius: "md",
        shadow: "sm",
        withBorder: true,
      },
    },
    Card: {
      defaultProps: {
        radius: "md",
        shadow: "sm",
        withBorder: true,
      },
    },
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    TextInput: {
      defaultProps: {
        radius: "md",
      },
    },
    Select: {
      defaultProps: {
        radius: "md",
      },
    },
    Badge: {
      defaultProps: {
        radius: "sm",
      },
    },
  },
});

export function MantineWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light" forceColorScheme="light">
      {children}
      <Toaster position="top-right" richColors closeButton theme="light" />
    </MantineProvider>
  );
}
