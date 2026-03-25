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

function scheduleColumnsBase(): DataTableColumn<Schedule>[] {
  return [
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
    label: "Partner",
    render: (s) => (
      <Text size="sm" c="dimmed">
        {s.farmer_display_name || "—"}
      </Text>
    ),
  },
  {
    key: "farm_display_name",
    label: "Location",
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
}

export interface ScheduleColumnsConfig {
  canApprove: boolean;
  canEditSchedule: boolean;
  isOfficer?: boolean;
  officerUserId?: string | null;
  officerEmail?: string | null;
  approvingId: string | null;
  onApprove: (scheduleId: string, action: "accept") => void;
  onRejectClick: (schedule: Schedule) => void;
  onOpenEdit: (schedule: Schedule) => void;
}

export function getScheduleColumns(
  config: ScheduleColumnsConfig | null,
  labels?: { partner: string; location: string }
): DataTableColumn<Schedule>[] {
  void labels;
  const base = scheduleColumnsBase();
  if (!config?.canApprove && !config?.canEditSchedule) {
    return base;
  }
  const {
    canApprove,
    canEditSchedule,
    isOfficer,
    officerUserId,
    officerEmail,
    approvingId,
    onApprove,
    onRejectClick,
    onOpenEdit,
  } = config;
  const editContext = { isOfficer, officerUserId, officerEmail };
  return [
    ...base,
    {
      key: "edit_reason",
      label: "Change reason",
      visibleFrom: "md",
      render: (s) =>
        s.status === "proposed" && s.edit_reason ? (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {s.edit_reason}
          </Text>
        ) : null,
    },
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
      render: (s) => {
        const editable =
          canEditSchedule && isScheduleEditable(s, editContext);
        if (s.status === "proposed") {
          return (
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
              {editable && (
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
          );
        }
        if (s.status === "accepted" && editable) {
          return (
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                color="blue"
                onClick={() => onOpenEdit(s)}
              >
                Request change
              </Button>
            </Group>
          );
        }
        return null;
      },
    },
  ];
}
