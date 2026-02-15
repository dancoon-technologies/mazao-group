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
  TextInput,
} from "@mantine/core";
import { useCallback, useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormFields } from "@/hooks/useFormFields";
import { api } from "@/lib/api";
import type { StaffUser } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROLES } from "@/lib/constants";

function roleLabel(role: string): string {
  return role === ROLES.SUPERVISOR ? "Supervisor" : "Extension Officer";
}

const STAFF_COLUMNS: DataTableColumn<StaffUser>[] = [
  {
    key: "email",
    label: "Email",
    render: (u) => (
      <Text size="sm" fw={500}>
        {u.email}
      </Text>
    ),
  },
  {
    key: "display_name",
    label: "Name",
    render: (u) => <Text size="sm" c="dimmed">{u.display_name || "—"}</Text>,
  },
  {
    key: "phone",
    label: "Phone",
    render: (u) => <Text size="sm" c="dimmed">{u.phone || "—"}</Text>,
  },
  {
    key: "role",
    label: "Role",
    render: (u) => <Text size="sm">{roleLabel(u.role)}</Text>,
  },
  {
    key: "region",
    label: "Region",
    render: (u) => <Text size="sm" c="dimmed">{u.region || "—"}</Text>,
  },
];

const INITIAL_STAFF_FORM = {
  email: "",
  role: "" as "" | typeof ROLES.SUPERVISOR | typeof ROLES.OFFICER,
  first_name: "",
  middle_name: "",
  last_name: "",
  phone: "",
  region: "",
};

export default function StaffPage() {
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;

  const { data: staffData, error, loading, refetch } = useAsyncData(
    () => (isAdmin ? api.getStaff() : Promise.resolve([])),
    [isAdmin]
  );
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [form, updateField, resetForm] = useFormFields(INITIAL_STAFF_FORM);

  const handleResend = useCallback(
    async (id: string) => {
      setResendError("");
      setResendMessage("");
      setResendingId(id);
      try {
        await api.resendStaffCredentials(id);
        setResendMessage("Credentials email sent. The staff member can use the new temporary password to sign in.");
        refetch();
      } catch (err) {
        setResendError(err instanceof Error ? err.message : "Failed to resend credentials");
      } finally {
        setResendingId(null);
      }
    },
    [refetch]
  );

  const staffColumns = useMemo<DataTableColumn<StaffUser>[]>(
    () => [
      ...STAFF_COLUMNS,
      {
        key: "resend",
        label: "",
        render: (u) => (
          <Button
            size="xs"
            variant="light"
            color="green"
            loading={resendingId === u.id}
            onClick={() => handleResend(u.id)}
          >
            Resend email
          </Button>
        ),
      },
    ],
    [handleResend, resendingId]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");
      const email = (form.email ?? "").trim();
      const first = (form.first_name ?? "").trim();
      const middle = (form.middle_name ?? "").trim();
      const last = (form.last_name ?? "").trim();
      const phone = (form.phone ?? "").trim();
      const region = (form.region ?? "").trim();
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
          region: region || undefined,
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

  const staff = staffData ?? [];

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

      {showForm && (
        <Paper mt="md" p="md" radius="md" shadow="sm" withBorder>
          <Text size="lg" fw={600} mb="md">
            Register staff
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            A temporary password will be generated and sent to the staff member&apos;s email. They must change it on first login.
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
              <NativeSelect
                label="Role"
                required
                data={[
                  { value: "", label: "Select role" },
                  { value: ROLES.SUPERVISOR, label: "Supervisor" },
                  { value: ROLES.OFFICER, label: "Extension Officer" },
                ]}
                value={form.role}
                onChange={(e) =>
                  updateField("role", e.target.value as typeof ROLES.SUPERVISOR | typeof ROLES.OFFICER)
                }
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
              <TextInput
                label="Region"
                placeholder="e.g. North, South"
                value={form.region}
                onChange={(e) => updateField("region", e.target.value)}
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
      {resendError && (
        <Alert color="red" variant="light" mt="md" onClose={() => setResendError("")} withCloseButton>
          {resendError}
        </Alert>
      )}

      <DataTable
        data={staff}
        rowKey="id"
        columns={staffColumns}
        minWidth={400}
        emptyMessage="No staff registered yet"
      />
    </Box>
  );
}
