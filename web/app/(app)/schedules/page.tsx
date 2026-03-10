"use client";

import { DataTable, type DataTableColumn, PageError, PageHeader, PageLoading } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormFields } from "@/hooks/useFormFields";
import { api } from "@/lib/api";
import { PAGE_BOX_MIN_WIDTH, ROLES_CAN_CREATE_SCHEDULES } from "@/lib/constants";
import { formatDate, pluralize } from "@/lib/format";
import type { Farm, Farmer, Schedule, StaffUser } from "@/lib/types";
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useCallback, useEffect, useMemo, useState } from "react";

function scheduleStatusColor(status: string) {
  switch (status) {
    case "proposed":
      return "yellow";
    case "accepted":
      return "green";
    case "rejected":
      return "red";
    default:
      return "gray";
  }
}

function scheduleStatusLabel(status: string): string {
  switch (status) {
    case "proposed":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

/** Proposed schedule is editable only if the scheduled date is more than one day from today (at least 2 days ahead). */
function isScheduleEditable(schedule: Schedule): boolean {
  if (schedule.status !== "proposed") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(schedule.scheduled_date + "T00:00:00");
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 2;
}

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
      <Text size="sm" fw={500}>
        {s.officer_email}
      </Text>
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

const INITIAL_SCHEDULE_FORM = {
  officer: "",
  farmer: "",
  farm: "",
  scheduled_date: "",
  notes: "",
};

export default function SchedulesPage() {
  const { role } = useAuth();
  const canCreate = role !== null && ROLES_CAN_CREATE_SCHEDULES.includes(role);
  const canApprove = role === "admin" || role === "supervisor";
  const canEditSchedule = role === "supervisor" || role === "officer";
  const isOfficer = role === "officer";
  const isAdminOrSupervisor = role === "admin" || role === "supervisor";

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [officers, setOfficers] = useState<StaffUser[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [form, updateField, resetForm] = useFormFields(INITIAL_SCHEDULE_FORM);

  const handleApprove = useCallback(
    async (scheduleId: string, action: "accept" | "reject") => {
      setApprovingId(scheduleId);
      try {
        const updated = await api.approveSchedule(scheduleId, action);
        setSchedules((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update schedule");
      } finally {
        setApprovingId(null);
      }
    },
    []
  );

  const openEdit = useCallback(
    (s: Schedule) => {
      setEditingSchedule(s);
      updateField("scheduled_date", s.scheduled_date);
      updateField("farmer", s.farmer ?? "");
      updateField("farm", s.farm ?? "");
      updateField("notes", s.notes ?? "");
      updateField("officer", s.officer ?? "");
    },
    [updateField]
  );

  const closeEditModal = useCallback(() => {
    setEditingSchedule(null);
    resetForm();
  }, [resetForm]);

  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingSchedule) return;
      setFormError("");
      if (!form.scheduled_date) {
        setFormError("Date is required.");
        return;
      }
      setSubmitting(true);
      try {
        const payload: Parameters<typeof api.updateSchedule>[1] = {
          farmer: form.farmer || null,
          farm: form.farm || null,
          scheduled_date: form.scheduled_date,
          notes: form.notes.trim() || undefined,
        };
        if (isAdminOrSupervisor && form.officer) payload.officer = form.officer;
        const updated = await api.updateSchedule(editingSchedule.id, payload);
        setSchedules((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        closeEditModal();
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Failed to update schedule"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [editingSchedule, form, isAdminOrSupervisor, closeEditModal]
  );

  const scheduleColumns = useMemo<DataTableColumn<Schedule>[]>(
    () =>
      canApprove || canEditSchedule
        ? [
            ...scheduleColumnsBase,
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
                          onClick={() => handleApprove(s.id, "accept")}
                        >
                          Accept
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          loading={approvingId === s.id}
                          onClick={() => handleApprove(s.id, "reject")}
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
                        onClick={() => openEdit(s)}
                      >
                        Request change
                      </Button>
                    )}
                  </Group>
                ) : null,
            },
          ]
        : scheduleColumnsBase,
    [canApprove, canEditSchedule, handleApprove, approvingId, openEdit]
  );

  const isAdmin = role === "admin";
  const loadData = useCallback(async () => {
    const [scheds, offs, fms] = await Promise.all([
      api.getSchedules(
        isAdmin && departmentFilter ? { department: departmentFilter } : undefined
      ),
      isAdminOrSupervisor ? api.getOfficers() : Promise.resolve([]),
      canCreate ? api.getFarmers() : Promise.resolve([]),
    ]);
    setSchedules(scheds);
    setOfficers(offs);
    setFarmers(fms);
  }, [canCreate, isAdminOrSupervisor, isAdmin, departmentFilter]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
    loadData()
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadData]);
  const { data: optionsData } = useAsyncData(
    (signal) => (isAdmin ? api.getOptions({ signal }) : Promise.resolve({ departments: [], staff_roles: [] })),
    [isAdmin]
  );
  const departmentOptions = useMemo(
    () => (optionsData?.departments ?? []).map((d) => ({ value: d.value, label: d.label })),
    [optionsData?.departments]
  );

  useEffect(() => {
    if (!form.farmer) {
      setFarms([]);
      return;
    }
    let cancelled = false;
    api
      .getFarms(form.farmer)
      .then((list) => {
        if (!cancelled) setFarms(list);
      })
      .catch(() => {
        if (!cancelled) setFarms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.farmer]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");
      if (isOfficer) {
        if (!form.scheduled_date) {
          setFormError("Date is required.");
          return;
        }
      } else {
        if (!form.officer || !form.scheduled_date) {
          setFormError("Officer and date are required.");
          return;
        }
      }
      setSubmitting(true);
      try {
        if (isOfficer) {
          await api.createSchedule({
            farmer: form.farmer || null,
            farm: form.farm || null,
            scheduled_date: form.scheduled_date,
            notes: form.notes.trim() || undefined,
          });
        } else {
          await api.createSchedule({
            officer: form.officer,
            farmer: form.farmer || null,
            farm: form.farm || null,
            scheduled_date: form.scheduled_date,
            notes: form.notes.trim() || undefined,
          });
        }
        resetForm();
        setShowForm(false);
        await loadData();
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Failed to create schedule"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [form, resetForm, loadData, isOfficer]
  );

  if (loading) return <PageLoading message="Loading schedules…" />;
  if (error) return <PageError message={error} />;

  const officerOptions = officers.map((o) => ({
    value: o.id,
    label: o.display_name
      ? `${o.display_name} (${o.email})`
      : `${o.email}${o.department ? ` — ${o.department}` : ""}${o.region ? ` (${o.region})` : ""}`,
  }));
  const farmerOptions = [
    { value: "", label: "— No specific farmer —" },
    ...farmers.map((f) => ({ value: f.id, label: f.display_name })),
  ];

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title="Schedules"
        subtitle={pluralize(schedules.length, "schedule") + " listed"}
        action={
          <Group>
            {isAdmin && (
              <Select
                placeholder="All departments"
                clearable
                data={departmentOptions}
                value={departmentFilter}
                onChange={setDepartmentFilter}
                style={{ minWidth: 180 }}
              />
            )}
            {canCreate ? (
              <Button color="green" onClick={() => setShowForm(true)}>
                {isOfficer ? "Propose schedule" : "New schedule"}
              </Button>
            ) : undefined}
          </Group>
        }
      />

      {canCreate && showForm && (
        <Paper mt="md" p="md" radius="md" shadow="sm" withBorder>
          <Text size="lg" fw={600} mb="md">
            {isOfficer ? "Propose visit schedule" : "New schedule"}
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            {isOfficer
              ? "Your proposal will be sent to your supervisor for approval."
              : "The officer will be notified. Schedule is created as accepted."}
          </Text>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {formError && (
                <Alert color="red" variant="light">
                  {formError}
                </Alert>
              )}
              {isAdminOrSupervisor && (
                <Select
                  label="Extension officer"
                  required
                  placeholder="Select officer"
                  data={officerOptions}
                  value={form.officer || null}
                  onChange={(v) => updateField("officer", v ?? "")}
                />
              )}
              <Select
                label="Farmer (optional)"
                description={isOfficer ? "Optional: link this visit to one of your assigned farmers." : undefined}
                placeholder="Select farmer"
                searchable
                clearable
                data={farmerOptions}
                value={form.farmer || null}
                onChange={(v) => {
                  updateField("farmer", v ?? "");
                  updateField("farm", "");
                }}
              />
              {form.farmer && (
                <Select
                  label="Farm (optional)"
                  placeholder="None or select farm"
                  searchable
                  clearable
                  data={[
                    { value: "", label: "— None —" },
                    ...farms.map((f) => ({ value: f.id, label: f.village })),
                  ]}
                  value={form.farm || null}
                  onChange={(v) => updateField("farm", v ?? "")}
                />
              )}
              <DateInput
                label="Scheduled date"
                placeholder="Pick date"
                value={form.scheduled_date || null}
                onChange={(value) =>
                  updateField("scheduled_date", value ?? "")
                }
                valueFormat="YYYY-MM-DD"
                required
                clearable
              />
              <Textarea
                label="Notes"
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
              <Group>
                <Button type="submit" color="green" loading={submitting}>
                  {submitting
                    ? "Saving…"
                    : isOfficer
                      ? "Propose schedule"
                      : "Create schedule"}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      )}

      <Modal
        opened={editingSchedule !== null}
        onClose={closeEditModal}
        title="Request schedule change"
        size="md"
      >
        {editingSchedule && (
          <Text size="sm" c="dimmed" mb="md">
            You can change the proposed visit only when it is more than one day away.
          </Text>
        )}
        <form onSubmit={handleEditSubmit}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" variant="light">
                {formError}
              </Alert>
            )}
            {isAdminOrSupervisor && editingSchedule && (
              <Select
                label="Extension officer"
                placeholder="Select officer"
                data={officerOptions}
                value={form.officer || null}
                onChange={(v) => updateField("officer", v ?? "")}
              />
            )}
            <Select
              label="Farmer (optional)"
              placeholder="Select farmer"
              searchable
              clearable
              data={farmerOptions}
              value={form.farmer || null}
              onChange={(v) => {
                updateField("farmer", v ?? "");
                updateField("farm", "");
              }}
            />
            {form.farmer && (
              <Select
                label="Farm (optional)"
                placeholder="None or select farm"
                searchable
                clearable
                data={[
                  { value: "", label: "— None —" },
                  ...farms.map((f) => ({ value: f.id, label: f.village })),
                ]}
                value={form.farm || null}
                onChange={(v) => updateField("farm", v ?? "")}
              />
            )}
            <DateInput
              label="Scheduled date"
              placeholder="Pick date"
              value={form.scheduled_date || null}
              onChange={(value) =>
                updateField("scheduled_date", value ?? "")
              }
              valueFormat="YYYY-MM-DD"
              required
              clearable
            />
            <Textarea
              label="Notes"
              placeholder="Optional notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
            <Group>
              <Button type="submit" color="blue" loading={submitting}>
                {submitting ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="default" onClick={closeEditModal}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <DataTable
        data={schedules}
        rowKey="id"
        columns={scheduleColumns}
        minWidth={500}
        emptyMessage="No schedules found"
        pageSize={15}
      />
    </Box>
  );
}
