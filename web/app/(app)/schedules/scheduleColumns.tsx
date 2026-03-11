"use client";

import { DataTable, type DataTableColumn } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Schedule } from "@/lib/types";
import { Badge, Button, Group, Stack, Text } from "@mantine/core";
import {
  scheduleStatusColor,
  scheduleStatusLabel,
  isScheduleEditable,
} from "./utils";

const scheduleColumnsBase: DataTableColumn<Schedule>[] = [
  {
    key: "scheduled_date",
    label: "Date",
    render: (s) => <Text size="sm">{formatDate(s.scheduled_date)}</Text>,
  },
  {
    key: "officer_email",
    label: "Officer",
    render: (s) => (
      <Stack gap={0}>
        <Text size="sm" fw={500}>
          {s.officer_display_name || s.officer_email || "—"}
        </Text>
        <Text size="xs" c="dimmed">
          {s.officer_email || ""}
        </Text>
      </Stack>
    ),
  },
  {
    key: "farmer_display_name",
    label: "Farmer",
    render: (s) => (
      <Text size="sm" c="dimmed">
        {s.farmer_display_name || "—"}
      </Text>
    ),
  },
  {
    key: "farm_display_name",
    label: "Farm",
    render: (s) => (
      <Text size="sm" c="dimmed">
        {s.farm_display_name ?? "None"}
      </Text>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (s) => (
      <Badge color={scheduleStatusColor(s.status)} variant="light" size="sm">
        {scheduleStatusLabel(s.status)}
      </Badge>
    ),
  },
  {
    key: "notes",
    label: "Notes",
    visibleFrom: "md",
    render: (s) => (
      <Text size="sm" c="dimmed" lineClamp={2}>
        {s.notes || "—"}
      </Text>
    ),
  },
];

export interface ScheduleColumnsConfig {
  canApprove: boolean;
  canEditSchedule: boolean;
  approvingId: string | null;
  onApprove: (scheduleId: string, action: "accept") => void;
  onRejectClick: (schedule: Schedule) => void;
  onOpenEdit: (schedule: Schedule) => void;
}

export function getScheduleColumns(
  config: ScheduleColumnsConfig | null
): DataTableColumn<Schedule>[] {
  if (!config?.canApprove && !config?.canEditSchedule) {
    return scheduleColumnsBase;
  }
  const { canApprove, canEditSchedule, approvingId, onApprove, onRejectClick, onOpenEdit } =
    config;
  return [
    ...scheduleColumnsBase,
    {
      key: "rejection_reason",
      label: "Rejection reason",
      visibleFrom: "md",
      render: (s) =>
        s.status === "rejected" && s.rejection_reason ? (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {s.rejection_reason}
          </Text>
        ) : null,
    },
    {
      key: "actions",
      label: "Actions",
      render: (s) =>
        s.status === "proposed" ? (
          <Group gap="xs">
            {canApprove && (
              <>
                <Button
                  size="xs"
                  variant="light"
                  color="green"
                  loading={approvingId === s.id}
                  onClick={() => onApprove(s.id, "accept")}
                >
                  Accept
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  loading={approvingId === s.id}
                  onClick={() => onRejectClick(s)}
                >
                  Decline
                </Button>
              </>
            )}
            {canEditSchedule && isScheduleEditable(s) && (
              <Button
                size="xs"
                variant="light"
                color="blue"
                onClick={() => onOpenEdit(s)}
              >
                Request change
              </Button>
            )}
          </Group>
        ) : null,
    },
  ];
}
