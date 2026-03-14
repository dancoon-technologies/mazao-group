"use client";

import {
  Box,
  Button,
  Card,
  Group,
  Pagination,
  Select,
  Stack,
  Text,
  Table,
  Alert,
  Paper,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import { formatLatLng } from "@/lib/format";
import type { LocationReport } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, PageLoading, PageError } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROLES, ROLES_TRACKING } from "@/lib/constants";

const DEFAULT_ZOOM = 8;
const KENYA_CENTER: [number, number] = [-1.292066, 36.821946];

const USER_MAP_COLORS = ["#228be6", "#40c057", "#fd7e14", "#be4bdb", "#fa5252", "#15aabf", "#fab005", "#7950f2"];
function userColorIndex(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h << 5) - h + userId.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % USER_MAP_COLORS.length;
}

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
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function TrackingPage() {
  const { role } = useAuth();
  const canView = role && ROLES_TRACKING.includes(role);
  const [dateFrom, setDateFrom] = useState(dateDaysAgo(0));
  const [dateTo, setDateTo] = useState(todayISO());
  const [userId, setUserId] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);

  const { data: staffData } = useAsyncData(
    (signal) => (role === ROLES.ADMIN ? api.getStaff({ signal }) : Promise.resolve([])),
    [role]
  );
  const staffList = staffData ?? [];
  const userOptions = useMemo(() => {
    const seen = new Set<string>();
    return staffList
      .filter((s) => s.id && !seen.has(s.id) && seen.add(s.id))
      .map((s) => ({
        value: String(s.id),
        label: s.display_name || s.email || String(s.id),
      }));
  }, [staffList]);
  const validUserIds = useMemo(
    () => new Set(userOptions.map((o) => o.value)),
    [userOptions]
  );
  const userSelectValue =
    userId && validUserIds.has(userId) ? userId : "__all__";

  const reportParams = useMemo(() => {
    const base = { user_id: userId ?? undefined, page_size: userId ? 500 : 200 };
    if (dateFrom && dateTo && dateFrom === dateTo) {
      return { ...base, date: dateFrom };
    }
    return { ...base, date_from: dateFrom, date_to: dateTo };
  }, [dateFrom, dateTo, userId]);

  const {
    data: reportsData,
    error,
    loading,
    refetch,
  } = useAsyncData(
    useCallback(
      (signal) => api.getTrackingReports(reportParams, { signal }),
      [reportParams]
    ),
    [reportParams]
  );

  const reports: LocationReport[] = reportsData?.results ?? [];

  const REPORTS_TABLE_PAGE_SIZE = 25;
  const totalTablePages = Math.max(1, Math.ceil(reports.length / REPORTS_TABLE_PAGE_SIZE));
  const paginatedReports = reports.slice(
    (tablePage - 1) * REPORTS_TABLE_PAGE_SIZE,
    tablePage * REPORTS_TABLE_PAGE_SIZE
  );

  // Reset table to page 1 when filters change
  useEffect(() => {
    setTablePage(1);
  }, [dateFrom, dateTo, userId]);

  // Poll for new reports every 30s when tab is visible (real-time updates without refresh)
  const POLL_INTERVAL_MS = 30_000;
  useEffect(() => {
    if (!canView) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        refetch();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [canView, refetch]);

  const reportTime = (r: LocationReport) => r.reported_at_server ?? r.reported_at;
  const latestByUser = useMemo(() => {
    const map = new Map<string, LocationReport>();
    for (const r of reports) {
      const existing = map.get(r.user_id);
      if (!existing || new Date(reportTime(r)) > new Date(reportTime(existing))) {
        map.set(r.user_id, r);
      }
    }
    return Array.from(map.values());
  }, [reports]);

  const reportsForMap = userId ? reports : latestByUser;
  const selectedUserLabel = userId
    ? staffList.find((s) => s.id === userId)?.display_name ||
      staffList.find((s) => s.id === userId)?.email ||
      "User"
    : null;

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
              value={userSelectValue}
              onChange={(v) => setUserId(v && v !== "__all__" ? v : null)}
              data={[{ value: "__all__", label: "All" }, ...userOptions]}
              style={{ minWidth: 180 }}
            />
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
              {userId
                ? `Path and points for ${selectedUserLabel} during work hours (${reports.length} reports).`
                : `All people on map (latest location each). Select a user to see their full route and points.`}
            </Text>
            {!userId && latestByUser.length > 0 && (
              <Group gap="sm" wrap="wrap">
                {latestByUser.map((r) => (
                  <Group key={r.user_id} gap={6}>
                    <Box
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: USER_MAP_COLORS[userColorIndex(r.user_id)],
                        flexShrink: 0,
                      }}
                    />
                    <Text size="sm">{r.user_display_name || r.user_email}</Text>
                  </Group>
                ))}
              </Group>
            )}
            <Paper withBorder radius="md" style={{ overflow: "hidden", minHeight: 400 }}>
              <MapView
                reports={reportsForMap}
                center={KENYA_CENTER}
                zoom={DEFAULT_ZOOM}
                singleUserPathMode={!!userId}
              />
            </Paper>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between" align="center" mb="xs">
                <Text fw={600}>Recent reports ({reports.length})</Text>
                {totalTablePages > 1 && (
                  <Pagination
                    size="sm"
                    total={totalTablePages}
                    value={tablePage}
                    onChange={setTablePage}
                    siblings={1}
                    boundaries={0}
                    withEdges
                  />
                )}
              </Group>
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
                  {paginatedReports.map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td>
                        <Text size="sm">{r.user_display_name || r.user_email}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatReportTime(reportTime(r))}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatLatLng(r.latitude, r.longitude)}</Text>
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
              {totalTablePages > 1 && (
                <Group justify="flex-end" mt="sm">
                  <Pagination
                    total={totalTablePages}
                    value={tablePage}
                    onChange={setTablePage}
                    siblings={1}
                    boundaries={0}
                    withEdges
                  />
                </Group>
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
