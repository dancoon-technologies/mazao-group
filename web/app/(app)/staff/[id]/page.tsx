"use client";

import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import type { StaffUser, Visit } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROLES, ROUTES } from "@/lib/constants";
import { formatDateTime, formatActivityType } from "@/lib/format";

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;
  const staffId = params?.id ?? "";

  const [generatingReport, setGeneratingReport] = useState(false);

  const { data: staff, error: staffError, loading: staffLoading } = useAsyncData(
    (signal) => (staffId && isAdmin ? api.getStaffById(staffId, { signal }) : Promise.reject(new Error("Missing id or access"))),
    [staffId, isAdmin]
  );
  const { data: visitsData = [] } = useAsyncData(
    (signal) => (staffId ? api.getVisits({ officer: staffId }, { signal }) : Promise.resolve([])),
    [staffId]
  );
  const { data: optionsData } = useAsyncData(
    (signal) => (isAdmin ? api.getOptions({ signal }) : Promise.resolve({ departments: [], staff_roles: [] })),
    [isAdmin]
  );

  const departmentLabelMap = useMemo(
    () => Object.fromEntries((optionsData?.departments ?? []).map((d) => [d.value, d.label])),
    [optionsData?.departments]
  );
  const roleLabelMap = useMemo(
    () => Object.fromEntries((optionsData?.staff_roles ?? []).map((r) => [r.value, r.label])),
    [optionsData?.staff_roles]
  );

  const visits = useMemo(() => (Array.isArray(visitsData) ? visitsData : []), [visitsData]);

  const visitColumns: DataTableColumn<Visit>[] = useMemo(
    () => [
      {
        key: "created_at",
        label: "Date",
        render: (v) => <Text size="sm" c="dimmed">{formatDateTime(v.created_at)}</Text>,
      },
      {
        key: "farmer",
        label: "Farmer",
        render: (v) => <Text size="sm">{v.farmer_display_name ?? v.farmer}</Text>,
      },
      {
        key: "farm",
        label: "Farm",
        render: (v) => <Text size="sm" c="dimmed">{v.farm_display_name ?? "—"}</Text>,
      },
      {
        key: "activity_type",
        label: "Activity",
        render: (v) => <Text size="sm">{formatActivityType(v.activity_type ?? "")}</Text>,
      },
      {
        key: "verification_status",
        label: "Status",
        render: (v) => (
          <Badge color={v.verification_status === "verified" ? "green" : "red"} variant="light" size="sm">
            {v.verification_status}
          </Badge>
        ),
      },
      {
        key: "notes",
        label: "Notes",
        render: (v) => <Text size="sm" c="dimmed" lineClamp={1}>{(v.notes ?? "").slice(0, 60)}</Text>,
      },
    ],
    []
  );

  const generateReport = useCallback(async () => {
    if (!staff) return;
    setGeneratingReport(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let y = 14;

      doc.setFontSize(16);
      doc.text("Staff Report", 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.text(`Generated ${formatDateTime(new Date().toISOString())}`, 14, y);
      y += 6;

      doc.setFontSize(11);
      doc.text("Staff details", 14, y);
      y += 6;
      doc.setFontSize(10);
      const details = [
        ["Name", staff.display_name || staff.email || "—"],
        ["Email", staff.email],
        ["Role", roleLabelMap[staff.role] ?? staff.role],
        ["Department", staff.department ? (departmentLabelMap[staff.department] ?? staff.department) : "—"],
        ["Region", staff.region || "—"],
        ["Status", staff.is_active !== false ? "Active" : "Inactive"],
      ];
      details.forEach(([label, value]) => {
        doc.text(`${label}: ${String(value)}`, 14, y);
        y += 5;
      });
      y += 6;

      doc.setFontSize(11);
      doc.text(`Visits (${visits.length})`, 14, y);
      y += 6;

      const head = ["Date", "Farmer", "Farm", "Activity", "Status", "Notes"];
      const body = visits.map((v: Visit) => [
        formatDateTime(v.created_at),
        (v.farmer_display_name ?? v.farmer) ?? "",
        v.farm_display_name ?? "",
        formatActivityType(v.activity_type ?? ""),
        v.verification_status ?? "",
        (v.notes ?? "").slice(0, 50),
      ]);
      autoTable(doc, {
        head: [head],
        body: body.length ? body : [["No visits recorded"]],
        startY: y,
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y;
      doc.setFontSize(9);
      doc.text(`Total visits: ${visits.length}`, 14, finalY + 8);

      doc.save(`staff-report-${staff.display_name || staff.email}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setGeneratingReport(false);
    }
  }, [staff, visits, departmentLabelMap, roleLabelMap]);

  if (!isAdmin) {
    return (
      <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
        <PageError title="Access denied" message="Only admins can view staff details." />
      </Box>
    );
  }

  if (staffLoading || !staffId) return <PageLoading message="Loading staff…" />;
  if (staffError || !staff) return <PageError message={staffError ?? "Staff not found."} />;

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title={staff.display_name || staff.email}
        subtitle={staff.email}
        action={
          <Group gap="xs">
            <Button
              variant="light"
              component={Link}
              href={ROUTES.STAFF}
            >
              Back to staff
            </Button>
            <Button color="green" loading={generatingReport} onClick={generateReport}>
              Generate report
            </Button>
          </Group>
        }
      />

      <Paper p="lg" radius="md" withBorder mb="xl">
        <Title order={3} size="h4" mb="md">
          Staff details
        </Title>
        <Stack gap="xs">
          <Group wrap="wrap" gap="xl">
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Name</Text>
              <Text size="sm">{staff.display_name || "—"}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Email</Text>
              <Text size="sm">{staff.email}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Role</Text>
              <Text size="sm">{roleLabelMap[staff.role] ?? staff.role}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Department</Text>
              <Text size="sm">{staff.department ? (departmentLabelMap[staff.department] ?? staff.department) : "—"}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Region</Text>
              <Text size="sm">{staff.region || "—"}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Status</Text>
              <Badge color={staff.is_active !== false ? "green" : "red"} variant="light" size="sm">
                {staff.is_active !== false ? "Active" : "Inactive"}
              </Badge>
            </Box>
          </Group>
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Title order={3} size="h4" mb="md">
          Visits ({visits.length})
        </Title>
        <DataTable
          data={visits}
          rowKey="id"
          columns={visitColumns}
          minWidth={600}
          emptyMessage="No visits recorded for this staff member."
          pageSize={15}
        />
      </Paper>
    </Box>
  );
}
