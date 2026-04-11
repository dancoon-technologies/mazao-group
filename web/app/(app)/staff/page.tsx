"use client";

import {
  Alert,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormFields } from "@/hooks/useFormFields";
import { api } from "@/lib/api";
import type { StaffUser, StaffPerformanceUser } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROLES } from "@/lib/constants";

function buildStaffColumns(
  departmentLabelMap: Record<string, string>,
  roleLabelMap: Record<string, string>
): DataTableColumn<StaffUser>[] {
  return [
    {
      key: "staff",
      label: "Staff",
      render: (u) => (
        <Stack gap={0}>
          <Text size="sm" fw={500} component={Link} href={`/staff/${u.id}`} style={{ textDecoration: "none", color: "var(--mantine-color-blue-6)" }}>
            {u.display_name || u.email || "—"}
          </Text>
          <Text size="xs" c="dimmed">{u.email}</Text>
        </Stack>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (u) => <Text size="sm" c="dimmed">{u.phone || "—"}</Text>,
    },
    {
      key: "role",
      label: "Role",
      render: (u) => <Text size="sm">{roleLabelMap[u.role] ?? u.role}</Text>,
    },
    {
      key: "department",
      label: "Department",
      render: (u) => (
        <Text size="sm" c="dimmed">
          {u.department ? (departmentLabelMap[u.department] ?? u.department) : "—"}
        </Text>
      ),
    },
    {
      key: "region",
      label: "Region",
      render: (u) => <Text size="sm" c="dimmed">{u.region || "—"}</Text>,
    },
    {
      key: "device",
      label: "Device",
      render: (u) =>
        u.device_registered ? (
          <Stack gap={0}>
            <Text size="sm" c="green">Registered</Text>
            <Text size="xs" c="dimmed">{u.device_id || "—"}</Text>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">Not registered</Text>
        ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (u) => (
        <Text size="sm" c={u.is_active !== false ? "green" : "red"}>
          {u.is_active !== false ? "Active" : "Inactive"}
        </Text>
      ),
    },
  ];
}

function buildPerformanceColumns(
  departmentLabelMap: Record<string, string>,
  roleLabelMap: Record<string, string>
): DataTableColumn<StaffPerformanceUser>[] {
  return [
    {
      key: "staff",
      label: "Staff",
      render: (u) => (
        <Stack gap={0}>
          <Text size="sm" fw={500} component={Link} href={`/staff/${u.id}`} style={{ textDecoration: "none", color: "var(--mantine-color-blue-6)" }}>
            {u.display_name || u.email || "—"}
          </Text>
          <Text size="xs" c="dimmed">{u.email}</Text>
        </Stack>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (u) => <Text size="sm">{roleLabelMap[u.role] ?? u.role}</Text>,
    },
    {
      key: "department",
      label: "Department",
      render: (u) => (
        <Text size="sm" c="dimmed">
          {u.department ? (departmentLabelMap[u.department] ?? u.department) : "—"}
        </Text>
      ),
    },
    {
      key: "visits_today",
      label: "Visits today",
      render: (u) => <Text size="sm" fw={500}>{u.visits_today ?? 0}</Text>,
    },
    {
      key: "visits_this_month",
      label: "Visits this month",
      render: (u) => <Text size="sm" fw={500}>{u.visits_this_month ?? 0}</Text>,
    },
    {
      key: "visits_total",
      label: "Total visits",
      render: (u) => <Text size="sm" c="dimmed">{u.visits_total ?? 0}</Text>,
    },
  ];
}

const INITIAL_STAFF_FORM = {
  email: "",
  role: "" as "" | typeof ROLES.SUPERVISOR | typeof ROLES.OFFICER,
  first_name: "",
  middle_name: "",
  last_name: "",
  phone: "",
  department: "",
  region_id: "",
  county_id: "",
  sub_county_id: "",
};

export default function StaffPage() {
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;

  const { data: staffData, error, loading, refetch } = useAsyncData(
    (signal) => (isAdmin ? api.getStaff({ signal }) : Promise.resolve([])),
    [isAdmin]
  );
  const { data: locationsData } = useAsyncData(
    (signal) => (isAdmin ? api.getLocations({ signal }) : Promise.resolve({ regions: [], counties: [], sub_counties: [] })),
    [isAdmin]
  );
  const { data: optionsData } = useAsyncData(
    (signal) => (isAdmin ? api.getOptions({ signal }) : Promise.resolve({ departments: [], staff_roles: [] })),
    [isAdmin]
  );
  const { data: performanceData = [] } = useAsyncData(
    (signal) => (isAdmin ? api.getStaffPerformance({ signal }) : Promise.resolve([])),
    [isAdmin]
  );
  const locations = locationsData ?? { regions: [], counties: [], sub_counties: [] };
  const options = optionsData ?? { departments: [], staff_roles: [] };

  const departmentLabelMap = useMemo(
    () => Object.fromEntries(options.departments.map((d) => [d.value, d.label])),
    [options.departments]
  );
  const roleLabelMap = useMemo(
    () => Object.fromEntries(options.staff_roles.map((r) => [r.value, r.label])),
    [options.staff_roles]
  );
  const departmentOptions = useMemo(
    () => [{ value: "", label: "Select department" }, ...options.departments],
    [options.departments]
  );
  const staffRoleOptions = useMemo(() => options.staff_roles, [options.staff_roles]);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [assignDepartment, setAssignDepartment] = useState("");
  const [assignRegionId, setAssignRegionId] = useState("");
  const [assignCountyId, setAssignCountyId] = useState("");
  const [assignSubCountyId, setAssignSubCountyId] = useState("");
  const [assignError, setAssignError] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [form, updateField, resetForm] = useFormFields(INITIAL_STAFF_FORM);

  const regionOptions = useMemo(
    () => locations.regions.map((r) => ({ value: String(r.id), label: r.name })),
    [locations.regions]
  );
  const countyOptions = useMemo(() => {
    if (!form.region_id) return [];
    return locations.counties
      .filter((c) => c.region_id === Number(form.region_id))
      .map((c) => ({ value: String(c.id), label: c.name }));
  }, [locations.counties, form.region_id]);
  const subCountyOptions = useMemo(() => {
    if (!form.county_id) return [];
    return locations.sub_counties
      .filter((s) => s.county_id === Number(form.county_id))
      .map((s) => ({ value: String(s.id), label: s.name }));
  }, [locations.sub_counties, form.county_id]);

  const assignCountyOptions = useMemo(() => {
    if (!assignRegionId) return [];
    return locations.counties
      .filter((c) => c.region_id === Number(assignRegionId))
      .map((c) => ({ value: String(c.id), label: c.name }));
  }, [locations.counties, assignRegionId]);
  const assignSubCountyOptions = useMemo(() => {
    if (!assignCountyId) return [];
    return locations.sub_counties
      .filter((s) => s.county_id === Number(assignCountyId))
      .map((s) => ({ value: String(s.id), label: s.name }));
  }, [locations.sub_counties, assignCountyId]);

  const handleResend = useCallback(
    async (id: string) => {
      setResendError("");
      setResendMessage("");
      setResendingId(id);
      try {
        await api.resendStaffCredentials(id);
        setResendMessage("Credentials email sent. The staff member can use their email and the new temporary password to access Mazao.");
        refetch();
      } catch (err) {
        setResendError(err instanceof Error ? err.message : "Failed to resend credentials");
      } finally {
        setResendingId(null);
      }
    },
    [refetch]
  );

  const handleDeactivate = useCallback(
    async (u: StaffUser) => {
      setResendError("");
      setResendMessage("");
      setDeactivatingId(u.id);
      try {
        await api.updateStaff(u.id, { is_active: !u.is_active });
        setResendMessage(u.is_active ? "Staff deactivated. They can no longer sign in." : "Staff reactivated.");
        refetch();
      } catch (err) {
        setResendError(err instanceof Error ? err.message : "Failed to update staff");
      } finally {
        setDeactivatingId(null);
      }
    },
    [refetch]
  );

  const openAssignModal = useCallback((u: StaffUser) => {
    setEditingUser(u);
    setAssignDepartment(u.department ?? "");
    setAssignRegionId(u.region_id != null ? String(u.region_id) : "");
    setAssignCountyId(u.county_id != null ? String(u.county_id) : "");
    setAssignSubCountyId(u.sub_county_id != null ? String(u.sub_county_id) : "");
    setAssignError("");
  }, []);

  const handleAssignSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;
      setAssignError("");
      setAssigningId(editingUser.id);
      try {
        await api.updateStaff(editingUser.id, {
          department: assignDepartment.trim() || undefined,
          region_id: assignRegionId ? Number(assignRegionId) : null,
          county_id: assignCountyId ? Number(assignCountyId) : null,
          sub_county_id: assignSubCountyId ? Number(assignSubCountyId) : null,
        });
        setEditingUser(null);
        await refetch();
        setResendMessage("Department and location updated.");
      } catch (err) {
        setAssignError(err instanceof Error ? err.message : "Failed to update assignment");
      } finally {
        setAssigningId(null);
      }
    },
    [editingUser, assignDepartment, assignRegionId, assignCountyId, assignSubCountyId, refetch]
  );

  const filteredStaff = useMemo(() => {
    const term = staffSearch.trim().toLowerCase();
    if (!term) return staffData ?? [];
    const list = staffData ?? [];
    return list.filter(
      (u) =>
        (u.display_name ?? "").toLowerCase().includes(term) ||
        (u.email ?? "").toLowerCase().includes(term) ||
        (u.phone ?? "").toLowerCase().includes(term) ||
        (roleLabelMap[u.role] ?? u.role ?? "").toLowerCase().includes(term) ||
        (departmentLabelMap[u.department] ?? u.department ?? "").toLowerCase().includes(term) ||
        (u.region ?? "").toLowerCase().includes(term) ||
        [u.first_name, u.middle_name, u.last_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
    );
  }, [staffData, staffSearch, roleLabelMap, departmentLabelMap]);

  const staffColumns = useMemo<DataTableColumn<StaffUser>[]>(
    () => [
      ...buildStaffColumns(departmentLabelMap, roleLabelMap),
      {
        key: "actions",
        label: "",
        render: (u) => (
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              color="blue"
              onClick={() => openAssignModal(u)}
            >
              Assign
            </Button>
            <Button
              size="xs"
              variant="light"
              color="green"
              loading={resendingId === u.id}
              onClick={() => handleResend(u.id)}
            >
              Resend credentials
            </Button>
            <Button
              size="xs"
              variant="light"
              color="orange"
              onClick={async () => {
                setResendError("");
                setResendMessage("");
                setResendingId(u.id);
                try {
                  const out = await api.resetStaffDevice(u.id);
                  setResendMessage(
                    out.detail ||
                      "Device binding reset. User can now sign in on a new phone; the next login will bind that device."
                  );
                } catch (err) {
                  setResendError(err instanceof Error ? err.message : "Failed to reset device");
                } finally {
                  setResendingId(null);
                }
              }}
            >
              Reset device
            </Button>
            <Button
              size="xs"
              variant="light"
              color={u.is_active !== false ? "red" : "green"}
              loading={deactivatingId === u.id}
              onClick={() => handleDeactivate(u)}
            >
              {u.is_active !== false ? "Deactivate" : "Reactivate"}
            </Button>
          </Group>
        ),
      },
    ],
    [
      departmentLabelMap,
      roleLabelMap,
      openAssignModal,
      handleResend,
      handleDeactivate,
      resendingId,
      deactivatingId,
    ]
  );

  const performanceColumns = useMemo<DataTableColumn<StaffPerformanceUser>[]>(
    () => buildPerformanceColumns(departmentLabelMap, roleLabelMap),
    [departmentLabelMap, roleLabelMap]
  );

  const performanceSorted = useMemo(
    () => [...(performanceData ?? [])].sort((a, b) => (b.visits_this_month ?? 0) - (a.visits_this_month ?? 0)),
    [performanceData]
  );

  const filteredPerformance = useMemo(() => {
    const term = staffSearch.trim().toLowerCase();
    if (!term) return performanceSorted;
    return performanceSorted.filter(
      (u) =>
        (u.display_name ?? "").toLowerCase().includes(term) ||
        (u.email ?? "").toLowerCase().includes(term) ||
        (u.phone ?? "").toLowerCase().includes(term) ||
        (roleLabelMap[u.role] ?? u.role ?? "").toLowerCase().includes(term) ||
        (departmentLabelMap[u.department] ?? u.department ?? "").toLowerCase().includes(term) ||
        (u.region ?? "").toLowerCase().includes(term) ||
        [u.first_name, u.middle_name, u.last_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
    );
  }, [performanceSorted, staffSearch, roleLabelMap, departmentLabelMap]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");
      const email = (form.email ?? "").trim();
      const first = (form.first_name ?? "").trim();
      const middle = (form.middle_name ?? "").trim();
      const last = (form.last_name ?? "").trim();
      const phone = (form.phone ?? "").trim();
      const department = (form.department ?? "").trim();
      if (!email || !form.role) {
        setFormError("Email and role are required.");
        return;
      }
      setSubmitting(true);
      try {
        await api.registerStaff({
          email,
          role: form.role,
          first_name: first || undefined,
          middle_name: middle || undefined,
          last_name: last || undefined,
          phone: phone || undefined,
          department: department || undefined,
          region_id: form.region_id ? Number(form.region_id) : null,
          county_id: form.county_id ? Number(form.county_id) : null,
          sub_county_id: form.sub_county_id ? Number(form.sub_county_id) : null,
        });
        resetForm();
        setShowForm(false);
        await refetch();
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Failed to register staff"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [form, resetForm, refetch]
  );

  if (!isAdmin && !loading) {
    return (
      <PageError
        title="Access denied"
        message="Only admins can view and manage staff."
      />
    );
  }

  if (loading) return <PageLoading message="Loading staff…" />;
  if (error) return <PageError message={error} />;

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title="Staff"
        subtitle="Supervisors and extension officers"
        action={
          <Button color="green" onClick={() => setShowForm(true)}>
            Register staff
          </Button>
        }
      />

      <Tabs defaultValue="staff" mt="md">
        <Tabs.List>
          <Tabs.Tab value="staff">Staff</Tabs.Tab>
          <Tabs.Tab value="performance">Performance</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="staff" pt="md">
      <TextInput
        placeholder="Search by name, email, phone, role, department, region…"
        value={staffSearch}
        onChange={(e) => setStaffSearch(e.currentTarget.value)}
        mb="md"
        leftSection={<IconSearch size={16} />}
        styles={{ root: { maxWidth: 400 } }}
      />
      {showForm && (
        <Paper mt="md" p="md" radius="md" shadow="sm" withBorder>
          <Text size="lg" fw={600} mb="md">
            Register staff
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            A temporary password will be generated and sent to the staff member&apos;s email.
          </Text>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {formError && (
                <Alert color="red" variant="light">
                  {formError}
                </Alert>
              )}
              <TextInput
                label="Email"
                type="email"
                required
                placeholder="user@example.com"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
              <Select
                label="Role"
                required
                placeholder="Select role"
                data={staffRoleOptions}
                value={form.role || null}
                onChange={(v) => updateField("role", v ?? "")}
              />
              <TextInput
                label="First name"
                placeholder="First name"
                value={form.first_name}
                onChange={(e) => updateField("first_name", e.target.value)}
              />
              <TextInput
                label="Middle name"
                placeholder="Middle name (optional)"
                value={form.middle_name}
                onChange={(e) => updateField("middle_name", e.target.value)}
              />
              <TextInput
                label="Last name"
                placeholder="Last name"
                value={form.last_name}
                onChange={(e) => updateField("last_name", e.target.value)}
              />
              <TextInput
                label="Phone"
                placeholder="e.g. +255..."
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
              <Select
                label="Department"
                placeholder="Select department"
                data={departmentOptions}
                value={form.department || null}
                onChange={(v) => updateField("department", v ?? "")}
              />
              <Select
                label="Region"
                placeholder="Search region…"
                searchable
                clearable
                data={regionOptions}
                value={form.region_id || null}
                onChange={(v) => {
                  updateField("region_id", v ?? "");
                  updateField("county_id", "");
                  updateField("sub_county_id", "");
                }}
              />
              <Select
                label="County"
                placeholder="Search county…"
                searchable
                clearable
                data={countyOptions}
                value={form.county_id || null}
                onChange={(v) => {
                  updateField("county_id", v ?? "");
                  updateField("sub_county_id", "");
                }}
              />
              <Select
                label="Sub-county"
                placeholder="Search sub-county…"
                searchable
                clearable
                data={subCountyOptions}
                value={form.sub_county_id || null}
                onChange={(v) => updateField("sub_county_id", v ?? "")}
              />
              <Group>
                <Button type="submit" color="green" loading={submitting}>
                  {submitting ? "Registering…" : "Register"}
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

      {resendMessage && (
        <Alert color="green" variant="light" mt="md" onClose={() => setResendMessage("")} withCloseButton>
          {resendMessage}
        </Alert>
      )}
      <Alert color="blue" variant="light" mt="md">
        Resetting device clears the current phone binding and active tokens for that staff account. The next successful login registers the new device automatically.
      </Alert>
      {resendError && (
        <Alert color="red" variant="light" mt="md" onClose={() => setResendError("")} withCloseButton>
          {resendError}
        </Alert>
      )}

      <Modal
        opened={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title="Assign department & location"
      >
        {editingUser && (
          <form onSubmit={handleAssignSubmit}>
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {editingUser.display_name || editingUser.email}
              </Text>
              {assignError && (
                <Alert color="red" variant="light">
                  {assignError}
                </Alert>
              )}
              <Select
                label="Department"
                placeholder="Select department"
                data={departmentOptions}
                value={assignDepartment || null}
                onChange={(v) => setAssignDepartment(v ?? "")}
              />
              <Select
                label="Region"
                placeholder="Search region…"
                searchable
                clearable
                data={regionOptions}
                value={assignRegionId || null}
                onChange={(v) => {
                  setAssignRegionId(v ?? "");
                  setAssignCountyId("");
                  setAssignSubCountyId("");
                }}
              />
              <Select
                label="County"
                placeholder="Search county…"
                searchable
                clearable
                data={assignCountyOptions}
                value={assignCountyId || null}
                onChange={(v) => {
                  setAssignCountyId(v ?? "");
                  setAssignSubCountyId("");
                }}
              />
              <Select
                label="Sub-county"
                placeholder="Search sub-county…"
                searchable
                clearable
                data={assignSubCountyOptions}
                value={assignSubCountyId || null}
                onChange={(v) => setAssignSubCountyId(v ?? "")}
              />
              <Group>
                <Button type="submit" color="green" loading={assigningId === editingUser.id}>
                  Save
                </Button>
                <Button type="button" variant="default" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      <DataTable
        data={filteredStaff}
        rowKey="id"
        columns={staffColumns}
        minWidth={400}
        emptyMessage={staffSearch.trim() ? "No staff match your search." : "No staff registered yet"}
        pageSize={15}
      />
        </Tabs.Panel>

        <Tabs.Panel value="performance" pt="md">
          <TextInput
            placeholder="Search by name, email, phone, role, department, region…"
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.currentTarget.value)}
            mb="md"
            leftSection={<IconSearch size={16} />}
            styles={{ root: { maxWidth: 400 } }}
          />
          <Paper p="md" radius="md" withBorder>
            <Text size="sm" c="dimmed" mb="md">
              Performance is based on number of visits recorded. Officers record visits; supervisors typically have zero.
            </Text>
            <DataTable
              data={filteredPerformance}
              rowKey="id"
              columns={performanceColumns}
              minWidth={500}
              emptyMessage={staffSearch.trim() ? "No staff match your search." : "No staff performance data"}
              pageSize={15}
            />
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
