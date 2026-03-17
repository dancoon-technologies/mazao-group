"use client";

import { DataTable, PageError, PageHeader, PageLoading } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormFields } from "@/hooks/useFormFields";
import { api } from "@/lib/api";
import { PAGE_BOX_MIN_WIDTH, ROLES_CAN_CREATE_SCHEDULES } from "@/lib/constants";
import { pluralize } from "@/lib/format";
import { getLabelsFromOptions } from "@/lib/options";
import type { Farm, Farmer, Schedule, StaffUser } from "@/lib/types";
import { Alert, Box, Button, Group, Modal, Select, Stack, Textarea } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getScheduleColumns } from "./scheduleColumns";
import { ScheduleEditModal } from "./ScheduleEditModal";
import { ScheduleForm } from "./ScheduleForm";
import { SelectFarmModal } from "./SelectFarmModal";
import { SelectFarmerModal } from "./SelectFarmerModal";
import { INITIAL_SCHEDULE_FORM, type ScheduleFormValues } from "./utils";

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
  const [rejectSchedule, setRejectSchedule] = useState<Schedule | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [farmerModalOpen, setFarmerModalOpen] = useState(false);
  const [farmModalOpen, setFarmModalOpen] = useState(false);
  const [farmerSearch, setFarmerSearch] = useState("");
  const [farmSearch, setFarmSearch] = useState("");
  const [form, updateField, resetForm] = useFormFields(INITIAL_SCHEDULE_FORM);

  const handleApprove = useCallback(
    async (scheduleId: string) => {
      setApprovingId(scheduleId);
      try {
        const updated = await api.approveSchedule(scheduleId, "accept");
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

  const onRejectClick = useCallback((schedule: Schedule) => {
    setRejectSchedule(schedule);
    setRejectReason("");
  }, []);

  const handleRejectSubmit = useCallback(async () => {
    if (!rejectSchedule) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError("Please provide a reason for rejecting this schedule.");
      return;
    }
    setRejectSubmitting(true);
    setError("");
    try {
      const updated = await api.approveSchedule(rejectSchedule.id, "reject", reason);
      setSchedules((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      setRejectSchedule(null);
      setRejectReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject schedule");
    } finally {
      setRejectSubmitting(false);
    }
  }, [rejectSchedule, rejectReason]);

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
    (signal) =>
      isAdmin
        ? api.getOptions({ signal })
        : Promise.resolve({ departments: [], staff_roles: [] }),
    [isAdmin]
  );
  const departmentOptions = useMemo(
    () =>
      (optionsData?.departments ?? []).map((d) => ({
        value: d.value,
        label: d.label,
      })),
    [optionsData?.departments]
  );
  const labels = useMemo(() => getLabelsFromOptions(optionsData), [optionsData]);

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

  const officerOptions = useMemo(
    () =>
      officers.map((o) => ({
        value: o.id,
        label: o.display_name
          ? `${o.display_name} (${o.email})`
          : `${o.email}${o.department ? ` — ${o.department}` : ""}${o.region ? ` (${o.region})` : ""}`,
      })),
    [officers]
  );

  const filteredFarmers = useMemo(() => {
    const q = farmerSearch.trim().toLowerCase();
    if (!q) return farmers;
    return farmers.filter(
      (f) =>
        (f.display_name ?? "").toLowerCase().includes(q) ||
        (f.phone ?? "").toLowerCase().includes(q) ||
        (f.first_name ?? "").toLowerCase().includes(q) ||
        (f.last_name ?? "").toLowerCase().includes(q)
    );
  }, [farmers, farmerSearch]);

  const filteredFarms = useMemo(() => {
    const q = farmSearch.trim().toLowerCase();
    if (!q) return farms;
    return farms.filter(
      (f) =>
        (f.village ?? "").toLowerCase().includes(q) ||
        (f.crop_type ?? "").toLowerCase().includes(q) ||
        (f.sub_county ?? "").toLowerCase().includes(q) ||
        (f.county ?? "").toLowerCase().includes(q)
    );
  }, [farms, farmSearch]);

  const selectedFarmer = farmers.find((f) => f.id === form.farmer);
  const selectedFarm = farms.find((f) => f.id === form.farm);

  const scheduleColumns = useMemo(
    () =>
      getScheduleColumns(
        canApprove || canEditSchedule
          ? {
              canApprove,
              canEditSchedule,
              approvingId,
              onApprove: handleApprove,
              onRejectClick,
              onOpenEdit: openEdit,
            }
          : null,
        labels
      ),
    [canApprove, canEditSchedule, approvingId, handleApprove, onRejectClick, openEdit, labels]
  );

  if (loading) return <PageLoading message="Loading schedules…" />;
  if (error) return <PageError message={error} />;

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

      {canApprove && (
        <Alert color="blue" variant="light" mt="md" mb="xs">
          Officers can edit proposed schedules when the date is more than one
          day away. Accept or reject a proposed schedule to confirm the current
          proposal; once accepted, it is reflected for the officer.
        </Alert>
      )}

      {canCreate && showForm && (
        <ScheduleForm
          isOfficer={isOfficer}
          isAdminOrSupervisor={isAdminOrSupervisor}
          officerOptions={officerOptions}
          form={form}
          updateField={updateField as (k: keyof ScheduleFormValues, v: string) => void}
          selectedFarmer={selectedFarmer}
          selectedFarm={selectedFarm}
          formError={formError}
          submitting={submitting}
          onOpenFarmerModal={() => {
            setFarmerSearch("");
            setFarmerModalOpen(true);
          }}
          onOpenFarmModal={() => {
            setFarmSearch("");
            setFarmModalOpen(true);
          }}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          partnerLabel={labels.partner}
          locationLabel={labels.location}
        />
      )}

      <SelectFarmerModal
        opened={farmerModalOpen}
        onClose={() => setFarmerModalOpen(false)}
        searchValue={farmerSearch}
        onSearchChange={setFarmerSearch}
        filteredFarmers={filteredFarmers}
        selectedFarmerId={form.farmer}
        onSelect={(id) => {
          updateField("farmer", id);
          updateField("farm", "");
        }}
        onClear={() => {
          updateField("farmer", "");
          updateField("farm", "");
        }}
      />

      <SelectFarmModal
        opened={farmModalOpen}
        onClose={() => setFarmModalOpen(false)}
        searchValue={farmSearch}
        onSearchChange={setFarmSearch}
        filteredFarms={filteredFarms}
        selectedFarmId={form.farm}
        onSelect={(id) => updateField("farm", id)}
        onClear={() => updateField("farm", "")}
      />

      <Modal
        opened={rejectSchedule !== null}
        onClose={() => {
          setRejectSchedule(null);
          setRejectReason("");
        }}
        title="Reject schedule"
      >
        {rejectSchedule && (
          <Stack gap="md">
            <Alert color="orange" variant="light">
              Provide a reason for rejecting this schedule. The officer will see it in their notification and on the schedule.
            </Alert>
            <Textarea
              label="Reason for rejection"
              placeholder="e.g. Date conflicts with another activity"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.currentTarget.value)}
              minRows={3}
              required
            />
            <Group>
              <Button
                color="red"
                loading={rejectSubmitting}
                disabled={!rejectReason.trim()}
                onClick={handleRejectSubmit}
              >
                Reject schedule
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  setRejectSchedule(null);
                  setRejectReason("");
                }}
              >
                Cancel
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <ScheduleEditModal
        schedule={editingSchedule}
        isAdminOrSupervisor={isAdminOrSupervisor}
        officerOptions={officerOptions}
        form={form}
        updateField={updateField as (k: keyof ScheduleFormValues, v: string) => void}
        selectedFarmer={selectedFarmer}
        selectedFarm={selectedFarm}
        formError={formError}
        submitting={submitting}
        onClose={closeEditModal}
        onSubmit={handleEditSubmit}
        onOpenFarmerModal={() => {
          setFarmerSearch("");
          setFarmerModalOpen(true);
        }}
        onOpenFarmModal={() => {
          setFarmSearch("");
          setFarmModalOpen(true);
        }}
        partnerLabel={labels.partner}
        locationLabel={labels.location}
      />

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
