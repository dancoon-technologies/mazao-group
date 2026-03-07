"use client";

import { Anchor, Badge, Box, Grid, Paper, Select, Table, Text, Title } from "@mantine/core";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import type { Visit } from "@/lib/types";
import { PageLoading, PageError } from "@/components/ui";
import { DASHBOARD_DAY_OPTIONS, PAGE_BOX_MIN_WIDTH, ROUTES } from "@/lib/constants";
import { formatDateTime, formatActivityType } from "@/lib/format";
import { useMemo, useState } from "react";

const STATS_CHART_DATA_KEYS = [
  { key: "visits_today", label: "Visits today", color: "var(--mantine-color-green-6)" },
  { key: "visits_this_month", label: "Visits this month", color: "var(--mantine-color-teal-6)" },
  { key: "active_officers", label: "Active officers", color: "var(--mantine-color-blue-6)" },
] as const;

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
      <Title order={1} size="h2">
        Dashboard
      </Title>
      <Text size="sm" c="dimmed" mt="xs">
        Overview of field visit activity
      </Text>
      <Grid mt="md" gutter="md">
        {cards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, sm: 4 }}>
            <Paper p="md" shadow="sm" radius="md" withBorder>
              <Text size="sm" fw={500} c="dimmed">
                {card.label}
              </Text>
              <Text size="xl" fw={600} mt="sm">
                {card.value}
              </Text>
            </Paper>
          </Grid.Col>
        ))}
      </Grid>

      <Grid mt="xl" gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" shadow="sm" radius="md" withBorder>
            <Text size="md" fw={600} mb="md">
              Key metrics
            </Text>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statsChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "var(--mantine-radius-md)", border: "1px solid var(--mantine-color-gray-3)" }}
                  formatter={(value: number, name: string) => [value, name]}
                />
                {STATS_CHART_DATA_KEYS.map(({ key, label, color }) => (
                  <Bar key={key} dataKey={key} name={label} fill={color} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" shadow="sm" radius="md" withBorder>
            <Box style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <Text size="md" fw={600}>
                Visits over time
              </Text>
              <Select
                size="xs"
                w={100}
                data={DASHBOARD_DAY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={days}
                onChange={(v) => v && setDays(v)}
              />
            </Box>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={visitsChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="visitsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--mantine-color-green-5)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--mantine-color-green-5)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "var(--mantine-radius-md)", border: "1px solid var(--mantine-color-gray-3)" }}
                  formatter={(value: number) => [value, "Visits"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
                />
                <Area type="monotone" dataKey="visits" name="Visits" stroke="var(--mantine-color-green-6)" fill="url(#visitsGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid.Col>
      </Grid>

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
