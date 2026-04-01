"use client";

import { AppShell, Box, Burger, Group, Text, UnstyledButton } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { APP_NAV, filterNavByRole } from "@/config/navigation";
import { ROUTES } from "@/lib/constants";
import { getLabelsFromOptions, pluralPartner } from "@/lib/options";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WebLocationTracker } from "@/components/WebLocationTracker";
import { LoadingScreen } from "@/components/ui";

// Load only on client so notifications API is never hit during SSR; avoids crashes if backend is down or missing.
const NotificationBell = dynamic(
  () => import("@/components/NotificationBell").then((m) => ({ default: m.NotificationBell })),
  { ssr: false }
);

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, logout, email, role, canAccessDashboard } =
    useAuth();
  const [opened, { toggle, close }] = useDisclosure();

  const { data: optionsData } = useAsyncData(
    (signal) => (isAuthenticated ? api.getOptions({ signal }) : Promise.resolve(null)),
    [isAuthenticated]
  );
  const labels = useMemo(() => getLabelsFromOptions(optionsData), [optionsData]);
  const trackingSettings = optionsData?.tracking_settings;
  const navWithLabels = useMemo(() => {
    const partnerPlural = pluralPartner(labels.partner);
    return APP_NAV.map((item) => {
      if (item.href === ROUTES.FARMERS) return { ...item, label: partnerPlural };
      return item;
    });
  }, [labels.partner]);
  const filteredNav = useMemo(
    () => filterNavByRole(navWithLabels, role ?? null, canAccessDashboard),
    [navWithLabels, role, canAccessDashboard]
  );

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      padding="md"
      styles={{
        header: {
          borderBottom: "1px solid var(--mantine-color-gray-2)",
          backgroundColor: "var(--mantine-color-white)",
        },
        navbar: {
          backgroundColor: "var(--mantine-color-gray-0)",
          borderRight: "1px solid var(--mantine-color-gray-2)",
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="md"
              size="sm"
              aria-label="Toggle menu"
            />
            <Text
              component={Link}
              href={filteredNav[0]?.href ?? ROUTES.FARMERS}
              fw={700}
              size="lg"
              visibleFrom="md"
              style={{ textDecoration: "none", color: "var(--mantine-color-green-7)" }}
            >
              Mazao Group
            </Text>
          </Group>
          <Group gap="xs">
            <ErrorBoundary fallback={null}>
              <NotificationBell />
            </ErrorBoundary>
            <UnstyledButton
              component="button"
              type="button"
              aria-label="Log out"
              title="Log out"
              onClick={() => logout()}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--mantine-color-gray-7)",
              }}
            >
              <IconLogout size={18} />
            </UnstyledButton>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          <Text
            component={Link}
            href={filteredNav[0]?.href ?? ROUTES.FARMERS}
            fw={700}
            size="lg"
            hiddenFrom="md"
            style={{ textDecoration: "none", color: "var(--mantine-color-green-7)" }}
            mb="md"
          >
            Mazao Group
          </Text>
          <Box mt="xs">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              const iconColor = active ? "var(--mantine-color-green-8)" : "var(--mantine-color-gray-7)";
              return (
                <UnstyledButton
                  key={item.href}
                  component={Link}
                  href={item.href}
                  style={{ textDecoration: "none", color: "inherit" }}
                  w="100%"
                  mb={4}
                >
                  <Group
                    gap="sm"
                    py="xs"
                    px="sm"
                    style={{
                      borderRadius: "var(--mantine-radius-md)",
                      backgroundColor: active ? "var(--mantine-color-green-0)" : "transparent",
                      color: iconColor,
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    <Box style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={22} stroke={1.75} color={iconColor} style={{ display: "block", flexShrink: 0 }} />
                    </Box>
                    <Text size="sm">{item.label}</Text>
                  </Group>
                </UnstyledButton>
              );
            })}
          </Box>
        </AppShell.Section>
        <AppShell.Section style={{ borderTop: "1px solid var(--mantine-color-gray-2)", paddingTop: "var(--mantine-spacing-md)" }}>
          <Text size="xs" c="dimmed" truncate title={email ?? undefined} mb="xs">
            {email}
          </Text>
          <UnstyledButton
            component="button"
            type="button"
            size="sm"
            c="dimmed"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              fontSize: "var(--mantine-font-size-sm)",
            }}
            onClick={() => logout()}
          >
            Log out
          </UnstyledButton>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className="app-main-content">
        <WebLocationTracker
          isAuthenticated={isAuthenticated}
          role={role ?? null}
          intervalMinutes={trackingSettings?.interval_minutes}
          workingHourStart={trackingSettings?.working_hour_start}
          workingHourEnd={trackingSettings?.working_hour_end}
        />
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell.Main>
    </AppShell>
  );
}
