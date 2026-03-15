"use client";

import { Anchor, Badge, Box, Grid, Paper, Table, Tabs, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import type { Visit } from "@/lib/types";
import { PageLoading, PageError } from "@/components/ui";
import { DashboardCharts, type DashboardChartSection } from "@/components/dashboard/DashboardCharts";
import { DASHBOARD_DAY_OPTIONS, PAGE_BOX_MIN_WIDTH, ROUTES } from "@/lib/constants";
import { formatDateTime, formatActivityType, formatActivityTypes } from "@/lib/format";
import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

function formatChartDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [days, setDays] = useState<string>(DASHBOARD_DAY_OPTIONS[1].value);
  const { data: stats, error, loading } = useAsyncData(
    (signal) => api.getDashboardStats({ signal }),
    []
  );
  const { data: visitsByDay = [] } = useAsyncData(
    (signal) => api.getDashboardVisitsByDay(parseInt(days, 10), { signal }),
    [days]
  );
  const { data: statsByDepartment = [] } = useAsyncData(
    (signal) => (isAdmin ? api.getDashboardStatsByDepartment({ signal }) : Promise.resolve([])),
    [isAdmin]
  );
  const { data: visitsByActivity = [] } = useAsyncData(
    (signal) => api.getDashboardVisitsByActivity({ signal }),
    []
  );
  const { data: topOfficers = [] } = useAsyncData(
    (signal) => api.getDashboardTopOfficers({ limit: 10 }, { signal }),
    []
  );
  const { data: schedulesSummary } = useAsyncData(
    (signal) => api.getDashboardSchedulesSummary({ signal }),
    []
  );
  const { data: recentVisitsData } = useAsyncData(
    (signal) => api.getVisits(undefined, { signal }),
    []
  );
  const recentVisits: Visit[] = (recentVisitsData ?? []).slice(0, 5);

  const statsChartData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        name: "Metrics",
        visits_today: stats.visits_today,
        visits_this_month: stats.visits_this_month,
        active_officers: stats.active_officers,
      },
    ];
  }, [stats]);

  const visitsChartData = useMemo(
    () =>
      visitsByDay?.map(({ date, count }) => ({
        date: formatChartDate(date),
        fullDate: date,
        visits: count,
      })) ?? [],
    [visitsByDay]
  );

  const cards = useMemo(() => {
    if (!stats) return [];
    type CardItem = { label: string; value: number | string; href?: string; linkLabel?: string };
    const base: CardItem[] = [
      { label: "Visits today", value: stats.visits_today, href: ROUTES.VISITS, linkLabel: "View visits" },
      { label: "Visits this month", value: stats.visits_this_month, href: ROUTES.VISITS, linkLabel: "View visits" },
      {
        label: "Active officers",
        value: stats.active_officers,
        ...(isAdmin ? { href: ROUTES.STAFF, linkLabel: "View staff" as const } : {}),
      },
    ];
    if (stats.verification_rate_pct != null) {
      base.push({
        label: "Verification rate",
        value: `${stats.verification_rate_pct}%`,
        href: ROUTES.VISITS,
        linkLabel: "View visits",
      });
    }
    if (isAdmin && stats.total_farmers != null) {
      base.push({ label: "Total farmers", value: stats.total_farmers, href: ROUTES.FARMERS, linkLabel: "View farmers" });
    }
    if (isAdmin && stats.total_farms != null) {
      base.push({ label: "Total farms", value: stats.total_farms, href: ROUTES.FARMS, linkLabel: "View farms" });
    }
    return base;
  }, [stats, isAdmin]);

  if (loading) return <PageLoading message="Loading dashboard…" />;
  if (error) return <PageError message={error} />;
  if (!stats) return null;

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <Title order={1} size="h2" fw={600}>
        Dashboard
      </Title>
      <Text size="sm" c="dimmed" mt="xs" mb="lg">
        Overview of field visit activity
      </Text>

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="visits">Visits & quality</Tabs.Tab>
          <Tabs.Tab value="performance">Performance</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="lg">
          <Grid gutter="lg">
            {cards.map((card) => (
              <Grid.Col key={card.label} span={{ base: 12, sm: 4, md: 2 }}>
                <Paper p="lg" radius="md" withBorder style={{ transition: "box-shadow 0.2s ease" }}>
                  <Text size="sm" fw={500} c="dimmed" tt="uppercase" lts={0.5}>
                    {card.label}
                  </Text>
                  <Text size="2rem" fw={700} mt="xs" lh={1.2} c="dark.7">
                    {card.value}
                  </Text>
                  {card.href && card.linkLabel && (
                    <Text size="xs" mt="sm" c="dimmed">
                      <Anchor component={Link} href={card.href} size="xs">
                        {card.linkLabel} →
                      </Anchor>
                    </Text>
                  )}
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
          {schedulesSummary && (
            <Paper p="md" mt="lg" radius="md" withBorder>
              <Text size="md" fw={600} mb="sm">
                Schedules pipeline (this month)
              </Text>
              <Grid gutter="md">
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <Text size="xs" c="dimmed">Proposed</Text>
                  <Text size="lg" fw={600}>{schedulesSummary.schedules_proposed_this_month}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <Text size="xs" c="dimmed">Accepted</Text>
                  <Text size="lg" fw={600}>{schedulesSummary.schedules_accepted_this_month}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <Text size="xs" c="dimmed">Scheduled today</Text>
                  <Text size="lg" fw={600}>{schedulesSummary.schedules_scheduled_today}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <Text size="xs" c="dimmed">Recorded today</Text>
                  <Text size="lg" fw={600}>{schedulesSummary.visits_recorded_today}</Text>
                </Grid.Col>
              </Grid>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="visits" pt="lg">
          <Box style={{ minHeight: 260 }}>
            <DashboardCharts
              statsChartData={[]}
              visitsChartData={visitsChartData}
              days={days}
              onDaysChange={setDays}
              statsByDepartment={[]}
              visitsByActivity={visitsByActivity ?? []}
              verificationData={
                stats.visits_verified != null && stats.visits_rejected != null
                  ? { verified: stats.visits_verified, rejected: stats.visits_rejected }
                  : undefined
              }
              sections={["visitsOverTime", "byActivity", "verification"] as DashboardChartSection[]}
            />
          </Box>
          {recentVisits.length > 0 && (
            <Paper mt="xl" p="md" shadow="sm" radius="md" withBorder>
              <Text size="md" fw={600} mb="sm">
                Recent visits
              </Text>
              <Table.ScrollContainer minWidth={400}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Farmer</Table.Th>
                      <Table.Th>Activity</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {recentVisits.map((v) => (
                      <Table.Tr key={v.id}>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {formatDateTime(v.created_at)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{v.farmer_display_name ?? v.farmer}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {formatActivityTypes(v.activity_types?.length ? v.activity_types : undefined) || formatActivityType(v.activity_type ?? "")}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={v.verification_status === "verified" ? "green" : "red"}
                            variant="light"
                            size="sm"
                          >
                            {v.verification_status}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              <Text size="sm" mt="sm">
                <Anchor component={Link} href={ROUTES.VISITS}>
                  View all visits →
                </Anchor>
              </Text>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="performance" pt="lg">
          <Box style={{ minHeight: 260 }}>
            <DashboardCharts
              statsChartData={statsChartData}
              visitsChartData={[]}
              days={days}
              onDaysChange={setDays}
              statsByDepartment={isAdmin ? (statsByDepartment ?? []) : []}
              visitsByActivity={[]}
              topOfficers={topOfficers ?? []}
              sections={
                isAdmin
                  ? (["keyMetrics", "byDepartment", "topOfficers"] as DashboardChartSection[])
                  : (["keyMetrics", "topOfficers"] as DashboardChartSection[])
              }
            />
          </Box>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
