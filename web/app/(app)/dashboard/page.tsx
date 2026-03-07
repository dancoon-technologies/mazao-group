"use client";

import { Anchor, Badge, Box, Grid, Paper, Table, Text, Title } from "@mantine/core";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import type { Visit } from "@/lib/types";
import { PageLoading, PageError } from "@/components/ui";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DASHBOARD_DAY_OPTIONS, PAGE_BOX_MIN_WIDTH, ROUTES } from "@/lib/constants";
import { formatDateTime, formatActivityType } from "@/lib/format";
import { useMemo, useState } from "react";

/** Load charts only on client so Recharts ResponsiveContainer gets valid dimensions (fixes invisible charts in Next.js). */
const DashboardChartsClient = dynamic(
  () => Promise.resolve(DashboardCharts),
  { ssr: false }
);

function formatChartDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [days, setDays] = useState<string>(DASHBOARD_DAY_OPTIONS[1].value);
  const { data: stats, error, loading } = useAsyncData(
    (signal) => api.getDashboardStats({ signal }),
    []
  );
  const { data: visitsByDay = [] } = useAsyncData(
    (signal) => api.getDashboardVisitsByDay(parseInt(days, 10), { signal }),
    [days]
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

  if (loading) return <PageLoading message="Loading dashboard…" />;
  if (error) return <PageError message={error} />;
  if (!stats) return null;

  const cards = [
    { label: "Visits today", value: stats.visits_today },
    { label: "Visits this month", value: stats.visits_this_month },
    { label: "Active officers", value: stats.active_officers },
  ];

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <Title order={1} size="h2" fw={600}>
        Dashboard
      </Title>
      <Text size="sm" c="dimmed" mt="xs" mb="lg">
        Overview of field visit activity
      </Text>
      <Grid gutter="lg">
        {cards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, sm: 4 }}>
            <Paper p="lg" radius="md" withBorder style={{ transition: "box-shadow 0.2s ease" }}>
              <Text size="sm" fw={500} c="dimmed" tt="uppercase" lts={0.5}>
                {card.label}
              </Text>
              <Text size="2rem" fw={700} mt="xs" lh={1.2} c="dark.7">
                {card.value}
              </Text>
            </Paper>
          </Grid.Col>
        ))}
      </Grid>

      <DashboardChartsClient
        statsChartData={statsChartData}
        visitsChartData={visitsChartData}
        days={days}
        onDaysChange={setDays}
      />

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
                        {formatActivityType(v.activity_type ?? "")}
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
    </Box>
  );
}
