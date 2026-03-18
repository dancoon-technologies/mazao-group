"use client";

import {
  Accordion,
  Anchor,
  Box,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/format";
import { PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROUTES } from "@/lib/constants";
import {
  buildVisitParams,
  getReportPeriodShortLabel,
  REPORT_PERIOD_OPTIONS,
  todayISO,
  type ReportPeriod,
} from "@/lib/reportFilters";
import { groupSalesByVisit } from "@/lib/sales";

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

  const visits = visitsData ?? [];
  const visitGroups = useMemo(() => groupSalesByVisit(visits), [visits]);

  const reportPeriodLabel = useMemo(
    () => getReportPeriodShortLabel(reportPeriod, reportDate),
    [reportPeriod, reportDate]
  );

  const officerOptions = useMemo(
    () => [{ value: "", label: "All officers" }, ...officers.map((o) => ({ value: o.id, label: o.display_name ? `${o.display_name} (${o.email})` : o.email }))],
    [officers]
  );

  if (!isAdminOrSupervisor) {
    return (
      <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
        <PageHeader title="Sales" />
        <Text c="dimmed">Only admins and supervisors can view sales from visits.</Text>
      </Box>
    );
  }

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
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

        {visitGroups.length === 0 ? (
          <Paper p="lg" withBorder style={{ minHeight: 80 }}>
            <Text c="dimmed" size="sm" style={{ lineHeight: 1.5 }}>
              No sales recorded in the selected period. Sales are taken from product lines and product focus on visits.
            </Text>
          </Paper>
        ) : (
          <Paper shadow="sm" radius="md" withBorder style={{ overflow: "hidden" }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Officer</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Total sold</Table.Th>
                  <Table.Th>Total given</Table.Th>
                  <Table.Th>Products</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visitGroups.map((g) => {
                  const totalSold = g.products.reduce(
                    (sum, p) => sum + (parseFloat(p.quantitySold) || 0),
                    0
                  );
                  const totalGiven = g.products.reduce(
                    (sum, p) => sum + (parseFloat(p.quantityGiven) || 0),
                    0
                  );
                  return (
                  <Table.Tr key={g.visitId}>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {formatDateTime(g.date)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{g.officerDisplay}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{g.partnerDisplay}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{totalSold}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{totalGiven}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Accordion
                        variant="separated"
                        radius="sm"
                        styles={{ content: { padding: 0 } }}
                      >
                        <Accordion.Item value={g.visitId}>
                          <Accordion.Control>
                            <Text size="sm" fw={500}>
                              {g.products.length} product{g.products.length !== 1 ? "s" : ""}
                            </Text>
                          </Accordion.Control>
                          <Accordion.Panel>
                            <Table withTableBorder withColumnBorders layout="fixed">
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>Product</Table.Th>
                                  <Table.Th>Qty sold</Table.Th>
                                  <Table.Th>Qty given</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {g.products.map((p, i) => (
                                  <Table.Tr key={i}>
                                    <Table.Td>
                                      <Text size="sm" fw={500}>
                                        {p.productName}
                                        {p.productUnit ? ` (${p.productUnit})` : ""}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text size="sm">{p.quantitySold}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text size="sm">{p.quantityGiven}</Text>
                                    </Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          </Accordion.Panel>
                        </Accordion.Item>
                      </Accordion>
                    </Table.Td>
                    <Table.Td>
                      <Anchor component={Link} href={ROUTES.VISITS} size="sm" c="green">
                        View visit
                      </Anchor>
                    </Table.Td>
                  </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
