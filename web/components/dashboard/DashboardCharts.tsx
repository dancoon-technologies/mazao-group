"use client";

import { Box, Grid, Paper, Select, Text } from "@mantine/core";
import { BarChart, LineChart } from "@mantine/charts";
import { DASHBOARD_DAY_OPTIONS } from "@/lib/constants";
import { formatActivityType } from "@/lib/format";
import type {
  DashboardStatsByDepartmentItem,
  DashboardTopOfficerItem,
  DashboardVisitsByActivityItem,
} from "@/lib/types";

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

export type DashboardChartSection =
  | "keyMetrics"
  | "visitsOverTime"
  | "byDepartment"
  | "byActivity"
  | "verification"
  | "topOfficers";

type Props = {
  statsChartData: StatsChartDatum[];
  visitsChartData: VisitsByDayDatum[];
  days: string;
  onDaysChange: (value: string) => void;
  /** Per-department stats (admin: all departments; supervisor: own). Shown as bar chart. */
  statsByDepartment?: DashboardStatsByDepartmentItem[];
  /** Visits count per activity_type. Shown as bar chart. */
  visitsByActivity?: DashboardVisitsByActivityItem[];
  /** Verified vs rejected counts for verification status chart. */
  verificationData?: { verified: number; rejected: number };
  /** Top officers by visits this month (for admin/supervisor). */
  topOfficers?: DashboardTopOfficerItem[];
  /** If set, only render these sections. Otherwise render all that have data. */
  sections?: DashboardChartSection[];
};

function showSection(sections: DashboardChartSection[] | undefined, key: DashboardChartSection): boolean {
  if (!sections || sections.length === 0) return true;
  return sections.includes(key);
}

export function DashboardCharts({
  statsChartData,
  visitsChartData,
  days,
  onDaysChange,
  statsByDepartment = [],
  visitsByActivity = [],
  verificationData,
  topOfficers = [],
  sections,
}: Props) {
  const hasStatsData = statsChartData.length > 0;
  const areaData = visitsChartData.length > 0
    ? visitsChartData
    : [{ date: "No data", fullDate: "", visits: 0 }];

  const verificationChartData =
    verificationData && (verificationData.verified > 0 || verificationData.rejected > 0)
      ? [
          { status: "Verified", verified: verificationData.verified, rejected: 0 },
          { status: "Rejected", verified: 0, rejected: verificationData.rejected },
        ]
      : [];

  const topOfficersChartData = topOfficers.map((o) => {
    const name = o.display_name || o.officer_email || "—";
    const withEmail = o.officer_email && name !== o.officer_email ? `${name} (${o.officer_email})` : name;
    return { name: withEmail, visits: o.visits_count };
  });

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
      {showSection(sections, "keyMetrics") && (
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
      )}
      {showSection(sections, "visitsOverTime") && (
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
      )}

      {showSection(sections, "byDepartment") && departmentChartData.length > 0 && (
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

      {showSection(sections, "byActivity") && activityChartData.length > 0 && (
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

      {showSection(sections, "verification") && verificationChartData.length > 0 && (
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" shadow="sm" radius="md" withBorder>
            <Text size="md" fw={600} mb="md">
              Visit verification status
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              All-time verified vs rejected (quality of field submissions)
            </Text>
            <Box style={{ width: "100%", minWidth: 200, height: CHART_HEIGHT }}>
              <BarChart
                h={CHART_HEIGHT}
                data={verificationChartData}
                dataKey="status"
                series={[
                  { name: "verified", color: "green.6" },
                  { name: "rejected", color: "red.6" },
                ]}
                tickLine="y"
                gridAxis="y"
              />
            </Box>
          </Paper>
        </Grid.Col>
      )}

      {showSection(sections, "topOfficers") && topOfficersChartData.length > 0 && (
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" shadow="sm" radius="md" withBorder>
            <Text size="md" fw={600} mb="md">
              Top officers this month
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              By number of visits recorded (for recognition and support)
            </Text>
            <Box style={{ width: "100%", minWidth: 200, height: CHART_HEIGHT }}>
              <BarChart
                h={CHART_HEIGHT}
                data={topOfficersChartData}
                dataKey="name"
                series={[{ name: "visits", color: "blue.6" }]}
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
