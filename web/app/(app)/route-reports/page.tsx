"use client";

import { Alert, Box, Select, Stack, Table, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageError, PageHeader, PageLoading } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { PAGE_BOX_MIN_WIDTH, ROLES_ROUTE_REPORTS_PAGE } from "@/lib/constants";
import { getWeekBounds, todayISO } from "@/lib/reportFilters";
import { reportDataToRemarks } from "@/lib/routeReportText";
import type { Route, RouteReport } from "@/lib/types";

function formatDate(iso: string): string {
  const raw = String(iso ?? "").trim();
  if (!raw) return "—";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Row = { route: Route; report: RouteReport };

export default function RouteReportsPage() {
  const { role } = useAuth();
  const canView = role !== null && ROLES_ROUTE_REPORTS_PAGE.includes(role);

  const [weekRef, setWeekRef] = useState(() => todayISO());
  const weekStart = useMemo(() => getWeekBounds(weekRef).from, [weekRef]);

  const weekOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const base = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i * 7);
      const ref = d.toISOString().slice(0, 10);
      const monday = getWeekBounds(ref).from;
      const label = `Week of ${formatDate(monday)}`;
      if (!out.some((o) => o.value === monday)) out.push({ value: monday, label });
    }
    return out;
  }, []);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError("");
    try {
      const routes = await api.getRoutes({ week_start: weekStart });
      const ordered = [...routes].sort((a, b) =>
        b.scheduled_date.localeCompare(a.scheduled_date)
      );
      const pairs = await Promise.all(
        ordered.map(async (route) => {
          try {
            const report = await api.getRouteReport(route.id);
            return { route, report };
          } catch {
            return null;
          }
        })
      );
      setRows(pairs.filter((x): x is Row => x !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load route reports.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return <PageError message="Route reports are available to supervisors and admins only." />;
  }

  if (loading) {
    return <PageLoading />;
  }

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title="Route reports"
        subtitle="End-of-day summaries submitted by officers from the mobile app (selected work week)."
      />

      {error ? (
        <Alert color="red" title="Error" mb="md">
          {error}
        </Alert>
      ) : null}

      <Stack gap="md" mb="md">
        <Select
          label="Week"
          data={weekOptions}
          value={weekStart}
          onChange={(v) => {
            if (v) {
              setWeekRef(v);
            }
          }}
          maw={360}
        />
      </Stack>

      {rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No routes in this week, or reports could not be loaded. Officers submit reports from the app after visits on
          that route.
        </Text>
      ) : (
        <Box style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <Table striped highlightOnHover withTableBorder withColumnBorders miw={720}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Officer</Table.Th>
                <Table.Th>Route</Table.Th>
                <Table.Th>Visits</Table.Th>
                <Table.Th>Remarks</Table.Th>
                <Table.Th>Submitted</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map(({ route, report }) => {
                const rd = report.report_data ?? {};
                const visits =
                  typeof rd.visits_count === "number"
                    ? rd.visits_count
                    : typeof rd.visits_count === "string"
                      ? rd.visits_count
                      : "—";
                const remarks = reportDataToRemarks(rd as Record<string, unknown>) || "—";
                return (
                  <Table.Tr key={route.id}>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>{formatDate(route.scheduled_date)}</Table.Td>
                    <Table.Td>{route.officer_display_name || route.officer_email || route.officer}</Table.Td>
                    <Table.Td maw={200}>
                      <Text size="sm" lineClamp={3}>
                        {route.name?.trim() || "Day route"}
                      </Text>
                    </Table.Td>
                    <Table.Td>{visits}</Table.Td>
                    <Table.Td maw={320}>
                      <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {remarks}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>{formatDateTime(report.submitted_at)}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
