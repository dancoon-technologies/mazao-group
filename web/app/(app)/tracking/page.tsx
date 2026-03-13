"use client";

import {
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  Table,
  Alert,
  Paper,
} from "@mantine/core";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import type { LocationReport } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, PageLoading, PageError } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROLES_TRACKING } from "@/lib/constants";

const DEFAULT_ZOOM = 8;
const KENYA_CENTER: [number, number] = [-1.292066, 36.821946];

const MapView = dynamic(
  () =>
    import("@/components/tracking/TrackingMap").then((m) => ({ default: m.TrackingMap })),
  { ssr: false }
);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatReportTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function TrackingPage() {
  const { role } = useAuth();
  const canView = role && ROLES_TRACKING.includes(role);
  const [dateFrom, setDateFrom] = useState(dateDaysAgo(0));
  const [dateTo, setDateTo] = useState(todayISO());
  const [userId, setUserId] = useState<string | null>(null);

  const { data: staffData } = useAsyncData(
    (signal) => api.getStaff({ signal }),
    []
  );
  const staffList = staffData ?? [];
  const userOptions = useMemo(
    () =>
      staffList.map((s) => ({
        value: s.id,
        label: s.display_name || s.email || s.id,
      })),
    [staffList]
  );

  const {
    data: reportsData,
    error,
    loading,
    refetch,
  } = useAsyncData(
    useCallback(
      async (signal) => {
        return api.getTrackingReports(
          {
            date_from: dateFrom,
            date_to: dateTo,
            user_id: userId ?? undefined,
            page_size: 200,
          },
          { signal }
        );
      },
      [dateFrom, dateTo, userId]
    ),
    [dateFrom, dateTo, userId]
  );

  const reports: LocationReport[] = reportsData?.results ?? [];

  const latestByUser = useMemo(() => {
    const map = new Map<string, LocationReport>();
    for (const r of reports) {
      const existing = map.get(r.user_id);
      if (!existing || new Date(r.reported_at) > new Date(existing.reported_at)) {
        map.set(r.user_id, r);
      }
    }
    return Array.from(map.values());
  }, [reports]);

  const hasData = reports.length > 0;
  const showCachedMessage = hasData && error;

  if (!canView) {
    return (
      <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
        <PageHeader title="Track team" />
        <PageError message="Only admin or supervisor can view team tracking." />
      </Box>
    );
  }

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader title="Track team" />
      <Stack gap="md">
        <Card withBorder p="md" radius="md">
          <Group align="flex-end" wrap="wrap" gap="sm">
            <Select
              label="Date from"
              value={dateFrom}
              onChange={(v) => setDateFrom(v ?? dateFrom)}
              data={[
                { value: dateDaysAgo(0), label: "Today" },
                { value: dateDaysAgo(1), label: "Yesterday" },
                { value: dateDaysAgo(6), label: "6 days ago" },
                { value: dateDaysAgo(29), label: "29 days ago" },
              ]}
              style={{ width: 140 }}
            />
            <Select
              label="Date to"
              value={dateTo}
              onChange={(v) => setDateTo(v ?? dateTo)}
              data={[
                { value: todayISO(), label: "Today" },
                { value: dateDaysAgo(1), label: "Yesterday" },
              ]}
              style={{ width: 140 }}
            />
            <Select
              label="User"
              placeholder="All"
              value={userId ?? ""}
              onChange={(v) => setUserId(v || null)}
              data={[{ value: "", label: "All" }, ...userOptions]}
              clearable
              style={{ minWidth: 180 }}
            />
            <Button onClick={() => refetch()} loading={loading} variant="light">
              Refresh
            </Button>
          </Group>
          {showCachedMessage && (
            <Alert mt="sm" color="yellow" title="Network issue">
              Showing last loaded data. {error} <Button variant="subtle" size="xs" onClick={() => refetch()}>Retry</Button>
            </Alert>
          )}
        </Card>

        {loading && !hasData && <PageLoading />}
        {error && !hasData && <PageError message={error} onRetry={refetch} />}

        {hasData && (
          <>
            <Text size="sm" c="dimmed">
              Location reports during working hours (with battery & device info). One marker per user (latest). Poor network: use filters and Refresh.
            </Text>
            <Paper withBorder radius="md" style={{ overflow: "hidden", minHeight: 400 }}>
              <MapView reports={latestByUser} center={KENYA_CENTER} zoom={DEFAULT_ZOOM} />
            </Paper>
            <Card withBorder p="md" radius="md">
              <Text fw={600} mb="xs">Recent reports ({reports.length})</Text>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Reported at</Table.Th>
                    <Table.Th>Location</Table.Th>
                    <Table.Th>Battery</Table.Th>
                    <Table.Th>Device</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {reports.slice(0, 50).map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td>
                        <Text size="sm">{r.user_display_name || r.user_email}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatReportTime(r.reported_at)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{r.battery_percent != null ? `${r.battery_percent}%` : "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {typeof r.device_info === "object" && r.device_info?.device_name
                            ? String(r.device_info.device_name)
                            : "—"}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              {reports.length > 50 && (
                <Text size="xs" c="dimmed" mt="xs">Showing first 50. Use filters to narrow.</Text>
              )}
            </Card>
          </>
        )}

        {!loading && !hasData && !error && (
          <Text c="dimmed">No location reports for the selected period. Reports are sent from the mobile app during working hours.</Text>
        )}
      </Stack>
    </Box>
  );
}
