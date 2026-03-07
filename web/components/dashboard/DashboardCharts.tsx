"use client";

import { Box, Grid, Paper, Select, Text } from "@mantine/core";
import {
  AreaChart,
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DASHBOARD_DAY_OPTIONS } from "@/lib/constants";

const STATS_CHART_KEYS = [
  { key: "visits_today", label: "Visits today", color: "var(--mantine-color-green-6)" },
  { key: "visits_this_month", label: "Visits this month", color: "var(--mantine-color-teal-6)" },
  { key: "active_officers", label: "Active officers", color: "var(--mantine-color-blue-6)" },
] as const;

const CHART_HEIGHT = 220;

export type StatsChartDatum = {
  name: string;
  visits_today: number;
  visits_this_month: number;
  active_officers: number;
};

export type VisitsByDayDatum = {
  date: string;
  fullDate: string;
  visits: number;
};

type Props = {
  statsChartData: StatsChartDatum[];
  visitsChartData: VisitsByDayDatum[];
  days: string;
  onDaysChange: (value: string) => void;
};

export function DashboardCharts({
  statsChartData,
  visitsChartData,
  days,
  onDaysChange,
}: Props) {
  return (
    <Grid mt="xl" gutter="md">
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p="md" shadow="sm" radius="md" withBorder>
          <Text size="md" fw={600} mb="md">
            Key metrics
          </Text>
          <Box style={{ width: "100%", height: CHART_HEIGHT, minHeight: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "var(--mantine-radius-md)",
                    border: "1px solid var(--mantine-color-gray-3)",
                  }}
                  formatter={(value: number, name: string) => [value, name]}
                />
                {STATS_CHART_KEYS.map(({ key, label, color }) => (
                  <Bar key={key} dataKey={key} name={label} fill={color} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p="md" shadow="sm" radius="md" withBorder>
          <Box
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Text size="md" fw={600}>
              Visits over time
            </Text>
            <Select
              size="xs"
              w={100}
              data={DASHBOARD_DAY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={days}
              onChange={(v) => v && onDaysChange(v)}
            />
          </Box>
          <Box style={{ width: "100%", height: CHART_HEIGHT, minHeight: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visitsChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="dashboardVisitsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--mantine-color-green-5)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--mantine-color-green-5)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "var(--mantine-radius-md)",
                    border: "1px solid var(--mantine-color-gray-3)",
                  }}
                  formatter={(value: number) => [value, "Visits"]}
                  labelFormatter={(_, payload) =>
                    (payload?.[0] as { payload?: { fullDate?: string } } | undefined)?.payload?.fullDate ?? ""
                  }
                />
                <Area
                  type="monotone"
                  dataKey="visits"
                  name="Visits"
                  stroke="var(--mantine-color-green-6)"
                  fill="url(#dashboardVisitsGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}
