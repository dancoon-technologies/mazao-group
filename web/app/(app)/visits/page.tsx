"use client";

import {
  Anchor,
  Badge,
  Box,
  Text,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api, photoUrl } from "@/lib/api";
import type { Visit } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime, pluralize } from "@/lib/format";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROLES } from "@/lib/constants";

const VISIT_COLUMNS: DataTableColumn<Visit>[] = [
  {
    key: "date",
    label: "Date",
    render: (v) => (
      <Text size="sm" c="dimmed">
        {formatDateTime(v.created_at)}
      </Text>
    ),
  },
  {
    key: "farmer",
    label: "Farmer",
    render: (v) => (
      <Text size="sm" fw={500} style={{ wordBreak: "break-all" }}>
        {v.farmer}
      </Text>
    ),
  },
  {
    key: "distance",
    label: "Distance",
    visibleFrom: "md",
    render: (v) => (
      <Text size="sm" c="dimmed">
        {v.distance_from_farmer != null
          ? `${Math.round(v.distance_from_farmer)} m`
          : "—"}
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
];

export default function VisitsPage() {
  const { role } = useAuth();
  const [dateFilter, setDateFilter] = useState("");
  const fetchVisits = useMemo(
    () => () =>
      api.getVisits(dateFilter ? { date: dateFilter } : undefined),
    [dateFilter]
  );
  const { data: visitsData, error, loading } = useAsyncData(
    fetchVisits,
    [dateFilter]
  );

  if (role === ROLES.OFFICER && !loading) {
    return (
      <PageError
        title="Access denied"
        message="Only admins and supervisors can view the visits list. Use Schedules to see your scheduled visits."
      />
    );
  }

  if (loading) return <PageLoading message="Loading visits…" />;
  if (error) return <PageError message={error} />;

  const visits = visitsData ?? [];

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title="Visits"
        subtitle={pluralize(visits.length, "visit") + " listed"}
        action={
          <TextInput
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="Filter by date"
          />
        }
      />

      <DataTable
        data={visits}
        rowKey="id"
        columns={VISIT_COLUMNS}
        minWidth={500}
        emptyMessage="No visits found"
      />
    </Box>
  );
}
