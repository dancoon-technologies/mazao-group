"use client";

import { Box, Grid, Paper, Select, Text } from "@mantine/core";
import { BarChart, LineChart } from "@mantine/charts";
import { DASHBOARD_DAY_OPTIONS } from "@/lib/constants";
import { formatActivityType } from "@/lib/format";
import type { DashboardStatsByDepartmentItem, DashboardVisitsByActivityItem } from "@/lib/types";

const CHART_HEIGHT = 220;

const STATS_SERIES = [
  { name: "visits_today", color: "green.6" },
  { name: "visits_this_month", color: "teal.6" },
  { name: "active_officers", color: "blue.6" },
] as const;

const DEPARTMENT_SERIES = [
  { name: "visits_today", color: "green.6" },
  { name: "visits_this_month", color: "teal.6" },
  { name: "active_officers", color: "blue.6" },
] as const;

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
  /** Per-department stats (admin: all departments; supervisor: own). Shown as bar chart. */
  statsByDepartment?: DashboardStatsByDepartmentItem[];
  /** Visits count per activity_type. Shown as bar chart. */
  visitsByActivity?: DashboardVisitsByActivityItem[];
};

export function DashboardCharts({
  statsChartData,
  visitsChartData,
  days,
  onDaysChange,
  statsByDepartment = [],
  visitsByActivity = [],
}: Props) {
  const hasStatsData = statsChartData.length > 0;
  const areaData = visitsChartData.length > 0
    ? visitsChartData
    : [{ date: "No data", fullDate: "", visits: 0 }];

  const departmentChartData = statsByDepartment.map((d) => ({
    department_name: d.department_name,
    visits_today: d.visits_today,
    visits_this_month: d.visits_this_month,
    active_officers: d.active_officers,
  }));

  const activityChartData = visitsByActivity.map((a) => ({
    activity_label: formatActivityType(a.activity_type),
    count: a.count,
  }));

  return (
    <Grid gutter="md">
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p="md" shadow="sm" radius="md" withBorder>
          <Text size="md" fw={600} mb="md">
            Key metrics
          </Text>
          <Box style={{ width: "100%", minWidth: 200, height: CHART_HEIGHT }}>
            {hasStatsData ? (
              <BarChart
                h={CHART_HEIGHT}
                data={statsChartData}
                dataKey="name"
                series={STATS_SERIES.map(({ name, color }) => ({ name, color }))}
                tickLine="y"
                gridAxis="y"
              />
            ) : (
              <Box style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Text size="sm" c="dimmed">No metrics yet</Text>
              </Box>
            )}
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
          <Box style={{ width: "100%", minWidth: 200, height: CHART_HEIGHT }}>
            <LineChart
              h={CHART_HEIGHT}
              data={areaData}
              dataKey="date"
              series={[{ name: "visits", color: "green.6" }]}
              curveType="linear"
            />
          </Box>
        </Paper>
      </Grid.Col>

      {departmentChartData.length > 0 && (
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" shadow="sm" radius="md" withBorder>
            <Text size="md" fw={600} mb="md">
              Metrics by department
            </Text>
            <Box style={{ width: "100%", minWidth: 200, height: CHART_HEIGHT }}>
              <BarChart
                h={CHART_HEIGHT}
                data={departmentChartData}
                dataKey="department_name"
                series={DEPARTMENT_SERIES.map(({ name, color }) => ({ name, color }))}
                tickLine="y"
                gridAxis="y"
              />
            </Box>
          </Paper>
        </Grid.Col>
      )}

      {activityChartData.length > 0 && (
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" shadow="sm" radius="md" withBorder>
            <Text size="md" fw={600} mb="md">
              Visits by farm activity
            </Text>
            <Box style={{ width: "100%", minWidth: 200, height: CHART_HEIGHT }}>
              <BarChart
                h={CHART_HEIGHT}
                data={activityChartData}
                dataKey="activity_label"
                series={[{ name: "count", color: "violet.6" }]}
                tickLine="y"
                gridAxis="y"
              />
            </Box>
          </Paper>
        </Grid.Col>
      )}
    </Grid>
  );
}
