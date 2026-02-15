"use client";

import {
  Alert,
  Box,
  Button,
  Group,
  NativeSelect,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { useFormFields } from "@/hooks/useFormFields";
import { api } from "@/lib/api";
import type { Schedule, Farmer, StaffUser } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, pluralize } from "@/lib/format";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROLES_CAN_CREATE_SCHEDULES } from "@/lib/constants";

const scheduleColumns: DataTableColumn<Schedule>[] = [
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
  scheduled_date: "",
  notes: "",
};

export default function SchedulesPage() {
  const { role } = useAuth();
  const canCreate = role !== null && ROLES_CAN_CREATE_SCHEDULES.includes(role);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [officers, setOfficers] = useState<StaffUser[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, updateField, resetForm] = useFormFields(INITIAL_SCHEDULE_FORM);

  const loadData = useCallback(async () => {
    const [scheds, offs, fms] = await Promise.all([
      api.getSchedules(),
      canCreate ? api.getOfficers() : Promise.resolve([]),
      canCreate ? api.getFarmers() : Promise.resolve([]),
    ]);
    setSchedules(scheds);
    setOfficers(offs);
    setFarmers(fms);
  }, [canCreate]);

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");
      if (!form.officer || !form.scheduled_date) {
        setFormError("Officer and date are required.");
        return;
      }
      setSubmitting(true);
      try {
        await api.createSchedule({
          officer: form.officer,
          farmer: form.farmer || null,
          scheduled_date: form.scheduled_date,
          notes: form.notes.trim() || undefined,
        });
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
    [form, resetForm, loadData]
  );

  if (loading) return <PageLoading message="Loading schedules…" />;
  if (error) return <PageError message={error} />;

  const officerOptions = officers.map((o) => ({
    value: o.id,
    label: o.display_name
      ? `${o.display_name} (${o.email})`
      : `${o.email}${o.region ? ` (${o.region})` : ""}`,
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
          canCreate ? (
            <Button color="green" onClick={() => setShowForm(true)}>
              New schedule
            </Button>
          ) : undefined
        }
      />

      {canCreate && showForm && (
        <Paper mt="md" p="md" radius="md" shadow="sm" withBorder>
          <Text size="lg" fw={600} mb="md">
            New schedule
          </Text>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {formError && (
                <Alert color="red" variant="light">
                  {formError}
                </Alert>
              )}
              <NativeSelect
                label="Extension officer"
                required
                data={[
                  { value: "", label: "Select officer" },
                  ...officerOptions,
                ]}
                value={form.officer}
                onChange={(e) => updateField("officer", e.target.value)}
              />
              <NativeSelect
                label="Farmer (optional)"
                data={farmerOptions}
                value={form.farmer}
                onChange={(e) => updateField("farmer", e.target.value)}
              />
              <TextInput
                type="date"
                label="Scheduled date"
                required
                value={form.scheduled_date}
                onChange={(e) =>
                  updateField("scheduled_date", e.target.value)
                }
              />
              <Textarea
                label="Notes"
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
              <Group>
                <Button type="submit" color="green" loading={submitting}>
                  {submitting ? "Saving…" : "Create schedule"}
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

      <DataTable
        data={schedules}
        rowKey="id"
        columns={scheduleColumns}
        minWidth={500}
        emptyMessage="No schedules found"
      />
    </Box>
  );
}
