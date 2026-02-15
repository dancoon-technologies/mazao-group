"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Toaster } from "sonner";

const theme = createTheme({
  primaryColor: "green",
  defaultRadius: "md",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
});

export function MantineWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        theme="system"
      />
    </MantineProvider>
  );
}
