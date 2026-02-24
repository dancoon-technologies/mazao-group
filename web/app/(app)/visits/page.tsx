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
import { useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api, photoUrl } from "@/lib/api";
import type { Visit } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime, formatActivityType, pluralize } from "@/lib/format";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH } from "@/lib/constants";

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

  const [dateFilter, setDateFilter] = useState("");
  const [officerFilter, setOfficerFilter] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchVisits = useMemo(
    () => () =>
      api.getVisits({
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(officerFilter ? { officer: officerFilter } : {}),
      }),
    [dateFilter, officerFilter]
  );
  const { data: visitsData, error, loading } = useAsyncData(fetchVisits, [dateFilter, officerFilter]);

  const { data: officersData } = useAsyncData(
    () => (isAdminOrSupervisor ? api.getOfficers() : Promise.resolve([])),
    [isAdminOrSupervisor]
  );
  const officers = officersData ?? [];

  const visits = visitsData ?? [];

  const officerOptions = useMemo(
    () => officers.map((o) => ({ value: o.id, label: o.display_name ? `${o.display_name} (${o.email})` : o.email })),
    [officers]
  );

  const handleExportExcel = () => {
    const XLSX = require("xlsx");
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
    XLSX.writeFile(wb, `visits-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
        subtitle={pluralize(visits.length, "visit") + " listed"}
        action={
          <Group>
            {isAdminOrSupervisor && (
              <Select
                placeholder="All officers"
                clearable
                data={officerOptions}
                value={officerFilter}
                onChange={setOfficerFilter}
                style={{ minWidth: 180 }}
              />
            )}
            <TextInput
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Filter by date"
            />
            {visits.length > 0 && (
              <Button variant="light" color="green" onClick={handleExportExcel}>
                Export Excel
              </Button>
            )}
          </Group>
        }
      />

      <DataTable
        data={visits}
        rowKey="id"
        columns={columns}
        minWidth={500}
        emptyMessage="No visits found"
      />

      <VisitDetailModal
        visit={selectedVisit}
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </Box>
  );
}
