"use client";

import { AppShell, Burger, Group, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { APP_NAV, filterNavByRole } from "@/config/navigation";
import { ROUTES } from "@/lib/constants";
import { LoadingScreen } from "@/components/ui";
import { NotificationBell } from "@/components/NotificationBell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, logout, email, role, canAccessDashboard, mustChangePassword } =
    useAuth();
  const [opened, { toggle, close }] = useDisclosure();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (mustChangePassword && pathname !== ROUTES.CHANGE_PASSWORD) {
      router.replace(ROUTES.CHANGE_PASSWORD);
    }
  }, [isAuthenticated, isLoading, mustChangePassword, pathname, router]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return null;
  }

  const filteredNav = filterNavByRole(APP_NAV, role ?? null, canAccessDashboard);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 256,
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
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
              fw={600}
              size="lg"
              visibleFrom="md"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              Mazao
            </Text>
          </Group>
          <NotificationBell />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          <Text
            component={Link}
            href={filteredNav[0]?.href ?? ROUTES.FARMERS}
            fw={600}
            size="lg"
            hiddenFrom="md"
            style={{ textDecoration: "none", color: "inherit" }}
            mb="md"
          >
            Mazao
          </Text>
          {filteredNav.map((item) => (
            <Text
              key={item.href}
              component={Link}
              href={item.href}
              size="sm"
              fw={pathname === item.href ? 600 : 500}
              py="xs"
              px="sm"
              mt={4}
              style={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
                borderRadius: "var(--mantine-radius-md)",
                backgroundColor:
                  pathname === item.href
                    ? "var(--mantine-color-default-hover)"
                    : "transparent",
              }}
            >
              {item.label}
            </Text>
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Text size="xs" c="dimmed" truncate title={email ?? undefined} mb="xs">
            {email}
          </Text>
          <Text
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
            }}
            onClick={() => logout()}
          >
            Log out
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
