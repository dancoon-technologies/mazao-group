"use client";

import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api, photoUrl } from "@/lib/api";
import type { Visit } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime, formatActivityType, pluralize } from "@/lib/format";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH } from "@/lib/constants";

type ReportPeriod = "daily" | "weekly" | "monthly";

function getWeekBounds(dateStr: string): { from: string; to: string } {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  const from = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

function getMonthBounds(ym: string): { from: string; to: string } {
  const from = ym + "-01";
  const d = new Date(ym + "-01T12:00:00");
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function VisitDetailModal({
  visit,
  opened,
  onClose,
}: {
  visit: Visit | null;
  opened: boolean;
  onClose: () => void;
}) {
  if (!visit) return null;
  const row = (label: string, value: React.ReactNode) => (
    <Group justify="space-between" wrap="nowrap" key={label}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" style={{ maxWidth: "60%", textAlign: "right" }}>
        {value ?? "—"}
      </Text>
    </Group>
  );
  return (
    <Modal opened={opened} onClose={onClose} title="Visit details" size="md">
      <Stack gap="sm">
        {row("Date", formatDateTime(visit.created_at))}
        {row("Officer", visit.officer_email ?? visit.officer)}
        {row("Farmer", visit.farmer_display_name ?? visit.farmer)}
        {row("Farm visited", visit.farm_display_name ?? "—")}
        {row("Activity", formatActivityType(visit.activity_type ?? ""))}
        {row("Status", (
          <Badge color={visit.verification_status === "verified" ? "green" : "red"} size="sm">
            {visit.verification_status}
          </Badge>
        ))}
        {row("Distance", visit.distance_from_farmer != null ? `${Math.round(visit.distance_from_farmer)} m` : "—")}
        {row("Crop stage", visit.crop_stage)}
        {row("Germination %", visit.germination_percent != null ? String(visit.germination_percent) : null)}
        {row("Survival rate", visit.survival_rate)}
        {row("Pests/diseases", visit.pests_diseases)}
        {row("Order value", visit.order_value != null ? String(visit.order_value) : null)}
        {row("Harvest (kg)", visit.harvest_kgs != null ? String(visit.harvest_kgs) : null)}
        {row("Farmers feedback", visit.farmers_feedback)}
        {row("Notes", visit.notes)}
        {visit.photo ? (
          <Anchor href={photoUrl(visit.photo)} target="_blank" rel="noopener noreferrer" size="sm">
            View photo
          </Anchor>
        ) : null}
      </Stack>
    </Modal>
  );
}

export default function VisitsPage() {
  const { role } = useAuth();
  const isAdminOrSupervisor = role === "admin" || role === "supervisor";
  const isAdmin = role === "admin";

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("daily");
  const [reportDate, setReportDate] = useState(() => todayISO());
  const [officerFilter, setOfficerFilter] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const visitParams = useMemo(() => {
    const base: Parameters<typeof api.getVisits>[0] = {
      ...(officerFilter ? { officer: officerFilter } : {}),
      ...(isAdmin && departmentFilter ? { department: departmentFilter } : {}),
    };
    if (reportPeriod === "daily") {
      return { ...base, date: reportDate };
    }
    if (reportPeriod === "weekly") {
      const { from, to } = getWeekBounds(reportDate);
      return { ...base, date_from: from, date_to: to };
    }
    const { from, to } = getMonthBounds(reportDate.slice(0, 7));
    return { ...base, date_from: from, date_to: to };
  }, [reportPeriod, reportDate, officerFilter, departmentFilter, isAdmin]);

  const fetchVisits = useCallback(
    (signal: AbortSignal) => api.getVisits(visitParams, { signal }),
    [visitParams]
  );
  const { data: visitsData, error, loading } = useAsyncData(fetchVisits, [visitParams]);

  const { data: officersData } = useAsyncData(
    (signal) => (isAdminOrSupervisor ? api.getOfficers({ signal }) : Promise.resolve([])),
    [isAdminOrSupervisor]
  );
  const officers = useMemo(() => officersData ?? [], [officersData]);

  const { data: optionsData } = useAsyncData(
    (signal) => (isAdmin ? api.getOptions({ signal }) : Promise.resolve({ departments: [], staff_roles: [] })),
    [isAdmin]
  );
  const departmentOptions = useMemo(
    () => (optionsData?.departments ?? []).map((d) => ({ value: d.value, label: d.label })),
    [optionsData?.departments]
  );

  const visits = visitsData ?? [];

  const reportPeriodLabel = useMemo(() => {
    if (reportPeriod === "daily") return `Daily report — ${reportDate}`;
    if (reportPeriod === "weekly") {
      const { from, to } = getWeekBounds(reportDate);
      return `Weekly report — ${from} to ${to}`;
    }
    const [y, m] = reportDate.slice(0, 7).split("-");
    const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString("default", { month: "long" });
    return `Monthly report — ${monthName} ${y}`;
  }, [reportPeriod, reportDate]);

  const officerOptions = useMemo(
    () => officers.map((o) => ({ value: o.id, label: o.display_name ? `${o.display_name} (${o.email})` : o.email })),
    [officers]
  );

  const exportFilenameBase = useMemo(() => {
    if (reportPeriod === "daily") return `visits-daily-${reportDate}`;
    if (reportPeriod === "weekly") {
      const { from, to } = getWeekBounds(reportDate);
      return `visits-weekly-${from}-to-${to}`;
    }
    return `visits-monthly-${reportDate.slice(0, 7)}`;
  }, [reportPeriod, reportDate]);

  const handleExportExcel = () => {
    const rows = visits.map((v) => ({
      Date: formatDateTime(v.created_at),
      Officer: v.officer_email ?? v.officer,
      Farmer: v.farmer_display_name ?? v.farmer,
      "Farm visited": v.farm_display_name ?? "",
      Activity: formatActivityType(v.activity_type ?? ""),
      "Crop stage": v.crop_stage ?? "",
      "Germination %": v.germination_percent ?? "",
      "Survival rate": v.survival_rate ?? "",
      "Pests/diseases": v.pests_diseases ?? "",
      "Order value": v.order_value ?? "",
      "Harvest (kg)": v.harvest_kgs ?? "",
      "Farmers feedback": v.farmers_feedback ?? "",
      Notes: v.notes ?? "",
      "Distance (m)": v.distance_from_farmer != null ? Math.round(v.distance_from_farmer) : "",
      Status: v.verification_status,
      "Photo URL": v.photo ? photoUrl(v.photo) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visits");
    XLSX.writeFile(wb, `${exportFilenameBase}.xlsx`);
  };

  const handleExportPdf = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const head = [
      "Date",
      "Officer",
      "Farmer",
      "Farm visited",
      "Activity",
      "Crop stage",
      "Germination %",
      "Survival",
      "Pests/diseases",
      "Order value",
      "Harvest (kg)",
      "Feedback",
      "Notes",
      "Distance (m)",
      "Status",
    ];
    const body = visits.map((v) => [
      formatDateTime(v.created_at),
      (v.officer_email ?? v.officer) ?? "",
      (v.farmer_display_name ?? v.farmer) ?? "",
      v.farm_display_name ?? "",
      formatActivityType(v.activity_type ?? ""),
      v.crop_stage ?? "",
      v.germination_percent != null ? String(v.germination_percent) : "",
      v.survival_rate ?? "",
      v.pests_diseases ?? "",
      v.order_value != null ? String(v.order_value) : "",
      v.harvest_kgs != null ? String(v.harvest_kgs) : "",
      v.farmers_feedback ?? "",
      (v.notes ?? "").slice(0, 40),
      v.distance_from_farmer != null ? String(Math.round(v.distance_from_farmer)) : "",
      v.verification_status ?? "",
    ]);
    doc.setFontSize(14);
    doc.text(reportPeriodLabel, 14, 12);
    doc.setFontSize(10);
    doc.text(`Generated ${formatDateTime(new Date().toISOString())} — ${visits.length} visit(s)`, 14, 18);
    autoTable(doc, {
      head: [head],
      body,
      startY: 22,
      styles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });
    doc.save(`${exportFilenameBase}.pdf`);
  };

  const openDetail = (v: Visit) => {
    setSelectedVisit(v);
    setDetailOpen(true);
  };

  const columns: DataTableColumn<Visit>[] = useMemo(
    () => [
      {
        key: "date",
        label: "Date",
        render: (v) => (
          <Text size="sm" c="dimmed">
            {formatDateTime(v.created_at)}
          </Text>
        ),
      },
      ...(isAdminOrSupervisor
        ? [{
            key: "officer",
            label: "Officer",
            render: (v: Visit) => (
              <Text size="sm" c="dimmed">
                {v.officer_email ?? v.officer}
              </Text>
            ),
          }]
        : []),
      {
        key: "farmer",
        label: "Farmer",
        render: (v) => (
          <Text size="sm" fw={500} style={{ wordBreak: "break-all" }}>
            {v.farmer_display_name ?? v.farmer}
          </Text>
        ),
      },
      {
        key: "activity_type",
        label: "Activity",
        visibleFrom: "md",
        render: (v) => (
          <Text size="sm" c="dimmed">
            {formatActivityType(v.activity_type ?? "")}
          </Text>
        ),
      },
      {
        key: "distance",
        label: "Distance",
        visibleFrom: "md",
        render: (v) => (
          <Text size="sm" c="dimmed">
            {v.distance_from_farmer != null ? `${Math.round(v.distance_from_farmer)} m` : "—"}
          </Text>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (v) => (
          <Badge
            color={v.verification_status === "verified" ? "green" : "red"}
            variant="light"
            size="sm"
          >
            {v.verification_status}
          </Badge>
        ),
      },
      {
        key: "photo",
        label: "Photo",
        render: (v) =>
          v.photo ? (
            <Anchor
              size="sm"
              href={photoUrl(v.photo)}
              target="_blank"
              rel="noopener noreferrer"
              c="green"
            >
              View
            </Anchor>
          ) : (
            <Text size="sm" c="dimmed">
              —
            </Text>
          ),
      },
      {
        key: "details",
        label: "",
        render: (v) => (
          <Button variant="subtle" size="xs" onClick={() => openDetail(v)}>
            Details
          </Button>
        ),
      },
    ],
    [isAdminOrSupervisor]
  );

  if (loading) return <PageLoading message="Loading visits…" />;
  if (error) return <PageError message={error} />;

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title="Visits"
        subtitle={reportPeriodLabel + " — " + pluralize(visits.length, "visit")}
        action={
          <Group wrap="wrap" align="flex-end">
            <Select
              label="Report period"
              size="sm"
              data={[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
              value={reportPeriod}
              onChange={(v) => v && setReportPeriod(v as ReportPeriod)}
              style={{ minWidth: 120 }}
            />
            {reportPeriod === "monthly" ? (
              <TextInput
                type="month"
                label="Month"
                size="sm"
                value={reportDate.slice(0, 7)}
                onChange={(e) => setReportDate((e.target.value || reportDate.slice(0, 7)) + "-01")}
              />
            ) : (
              <TextInput
                type="date"
                label={reportPeriod === "weekly" ? "Week of" : "Date"}
                size="sm"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value || todayISO())}
              />
            )}
            {isAdmin && (
              <Select
                placeholder="All departments"
                clearable
                data={departmentOptions}
                value={departmentFilter}
                onChange={setDepartmentFilter}
                style={{ minWidth: 180 }}
                size="sm"
              />
            )}
            {isAdminOrSupervisor && (
              <Select
                placeholder="All officers"
                clearable
                data={officerOptions}
                value={officerFilter}
                onChange={setOfficerFilter}
                style={{ minWidth: 180 }}
                size="sm"
              />
            )}
            <Group gap="xs">
              <Button variant="light" color="green" size="sm" onClick={handleExportExcel}>
                Generate Excel
              </Button>
              <Button variant="light" color="green" size="sm" onClick={handleExportPdf}>
                Generate PDF
              </Button>
            </Group>
          </Group>
        }
      />

      <DataTable
        data={visits}
        rowKey="id"
        columns={columns}
        minWidth={500}
        emptyMessage="No visits found"
        pageSize={15}
      />

      <VisitDetailModal
        visit={selectedVisit}
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </Box>
  );
}
