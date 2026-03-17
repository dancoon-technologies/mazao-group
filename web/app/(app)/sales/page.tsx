"use client";

import { Anchor, Box, Group, Paper, Select, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/format";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROUTES } from "@/lib/constants";
import { getLabelsFromOptions } from "@/lib/options";
import {
  buildVisitParams,
  getReportPeriodShortLabel,
  REPORT_PERIOD_OPTIONS,
  todayISO,
  type ReportPeriod,
} from "@/lib/reportFilters";
import { flattenVisitsToSales, type SalesRow } from "@/lib/sales";

export default function SalesPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const isAdminOrSupervisor = role === "admin" || role === "supervisor";

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("daily");
  const [reportDate, setReportDate] = useState(() => todayISO());
  const [officerFilter, setOfficerFilter] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);

  const visitParams = useMemo(
    () =>
      buildVisitParams(reportPeriod, reportDate, {
        officerFilter,
        departmentFilter,
        isAdmin,
      }),
    [reportPeriod, reportDate, officerFilter, departmentFilter, isAdmin]
  );

  const fetchVisits = useCallback(
    (signal: AbortSignal) => api.getVisits(visitParams, { signal }),
    [visitParams]
  );
  const { data: visitsData, error, loading, refetch } = useAsyncData(fetchVisits, [visitParams]);

  const { data: officersData } = useAsyncData(
    (signal) => (isAdminOrSupervisor ? api.getOfficers({ signal }) : Promise.resolve([])),
    [isAdminOrSupervisor]
  );
  const officers = useMemo(() => officersData ?? [], [officersData]);

  const { data: optionsData } = useAsyncData(
    (signal) => api.getOptions({ signal }),
    []
  );
  const departmentOptions = useMemo(
    () => (optionsData?.departments ?? []).map((d) => ({ value: d.value, label: d.label })),
    [optionsData?.departments]
  );

  const labels = useMemo(() => getLabelsFromOptions(optionsData), [optionsData]);

  const visits = visitsData ?? [];
  const salesRows = useMemo(() => flattenVisitsToSales(visits), [visits]);

  const reportPeriodLabel = useMemo(
    () => getReportPeriodShortLabel(reportPeriod, reportDate),
    [reportPeriod, reportDate]
  );

  const officerOptions = useMemo(
    () => [{ value: "", label: "All officers" }, ...officers.map((o) => ({ value: o.id, label: o.display_name ? `${o.display_name} (${o.email})` : o.email }))],
    [officers]
  );

  const columns: DataTableColumn<SalesRow>[] = useMemo(
    () => [
      {
        key: "date",
        label: "Date",
        render: (r) => (
          <Text size="sm" c="dimmed">
            {formatDateTime(r.date)}
          </Text>
        ),
      },
      {
        key: "officer",
        label: "Officer",
        render: (r) => <Text size="sm">{r.officerDisplay}</Text>,
      },
      {
        key: "partner",
        label: labels.partner,
        render: (r) => <Text size="sm">{r.partnerDisplay}</Text>,
      },
      {
        key: "location",
        label: labels.location,
        visibleFrom: "md",
        render: (r) => <Text size="sm" c="dimmed">{r.locationDisplay}</Text>,
      },
      {
        key: "product",
        label: "Product",
        render: (r) => (
          <Text size="sm" fw={500}>
            {r.productName}
            {r.productUnit ? ` (${r.productUnit})` : ""}
          </Text>
        ),
      },
      {
        key: "sold",
        label: "Qty sold",
        render: (r) => <Text size="sm">{r.quantitySold}</Text>,
      },
      {
        key: "given",
        label: "Qty given",
        render: (r) => <Text size="sm">{r.quantityGiven}</Text>,
      },
      {
        key: "visit",
        label: "",
        render: (r) => (
          <Anchor component={Link} href={ROUTES.VISITS} size="sm" c="green">
            View visit
          </Anchor>
        ),
      },
    ],
    [labels.partner, labels.location]
  );

  if (!isAdminOrSupervisor) {
    return (
      <Box maw={PAGE_BOX_MIN_WIDTH} mx="auto">
        <PageHeader title="Sales" />
        <Text c="dimmed">Only admins and supervisors can view sales from visits.</Text>
      </Box>
    );
  }

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <Box maw={PAGE_BOX_MIN_WIDTH} mx="auto">
      <PageHeader title="Sales from visits" />

      <Stack gap="md" mt="md">
        <Group wrap="wrap" align="flex-end" gap="md">
          <Select
            label="Period"
            data={REPORT_PERIOD_OPTIONS}
            value={reportPeriod}
            onChange={(v) => v && setReportPeriod(v as ReportPeriod)}
            size="sm"
            style={{ minWidth: 120 }}
          />
          <Select
            label={reportPeriod === "daily" ? "Date" : reportPeriod === "weekly" ? "Week starting" : "Month"}
            description={reportPeriodLabel}
            value={reportDate}
            onChange={(v) => v && setReportDate(v)}
            data={(() => {
              if (reportPeriod === "daily") {
                const out: { value: string; label: string }[] = [];
                for (let i = 14; i >= 0; i--) {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const v = d.toISOString().slice(0, 10);
                  out.push({ value: v, label: v });
                }
                return out;
              }
              if (reportPeriod === "weekly") {
                const out: { value: string; label: string }[] = [];
                for (let w = 0; w < 8; w++) {
                  const d = new Date();
                  d.setDate(d.getDate() - 7 * w);
                  const day = d.getDay();
                  const diffToMonday = day === 0 ? 6 : day - 1;
                  d.setDate(d.getDate() - diffToMonday);
                  const v = d.toISOString().slice(0, 10);
                  out.push({ value: v, label: v });
                }
                return out;
              }
              const out: { value: string; label: string }[] = [];
              for (let m = 0; m < 12; m++) {
                const d = new Date();
                d.setMonth(d.getMonth() - m);
                const v = d.toISOString().slice(0, 7);
                const label = d.toLocaleString("default", { month: "long", year: "numeric" });
                out.push({ value: v + "-01", label });
              }
              return out;
            })()}
            size="sm"
            style={{ minWidth: 200 }}
          />
          {isAdminOrSupervisor && (
            <Select
              label="Officer"
              data={officerOptions}
              value={officerFilter ?? ""}
              onChange={(v) => setOfficerFilter(v || null)}
              size="sm"
              clearable
              style={{ minWidth: 220 }}
            />
          )}
          {isAdmin && (
            <Select
              label="Department"
              data={[{ value: "", label: "All departments" }, ...departmentOptions]}
              value={departmentFilter ?? ""}
              onChange={(v) => setDepartmentFilter(v || null)}
              size="sm"
              clearable
              style={{ minWidth: 180 }}
            />
          )}
        </Group>

        {salesRows.length === 0 ? (
          <Paper p="lg" withBorder style={{ minHeight: 80 }}>
            <Text c="dimmed" size="sm" style={{ lineHeight: 1.5 }}>
              No sales recorded in the selected period. Sales are taken from product lines on visits.
            </Text>
          </Paper>
        ) : (
          <DataTable<SalesRow>
            data={salesRows}
            rowKey="id"
            columns={columns}
            emptyMessage="No sales in this period"
          />
        )}
      </Stack>
    </Box>
  );
}
