"use client";

import {
  Alert,
  Box,
  Button,
  Grid,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormFields } from "@/hooks/useFormFields";
import { api } from "@/lib/api";
import type { Farmer } from "@/lib/types";
import { pluralize } from "@/lib/format";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH } from "@/lib/constants";

const MapPicker = dynamic(
  () => import("@/components/MapPicker").then((m) => m.MapPicker),
  { ssr: false }
);

const STOCKIST_COLUMNS: DataTableColumn<Farmer>[] = [
  {
    key: "name",
    label: "Name",
    render: (f) => (
      <Link
        href={`/farmers/${f.id}`}
        style={{ color: "var(--mantine-color-yellow-7)", fontWeight: 500, textDecoration: "none", wordBreak: "break-word" }}
      >
        {f.display_name}
      </Link>
    ),
  },
  {
    key: "phone",
    label: "Phone",
    render: (f) => <Text size="sm" c="dimmed">{f.phone || "—"}</Text>,
  },
];

const INITIAL_FORM = {
  name: "",
  phone: "",
  latitude: "",
  longitude: "",
};

export default function StockistsPage() {
  const { data: stockistsData, error, loading, refetch } = useAsyncData(
    (signal) => api.getFarmers({ signal, is_sacco: true }),
    []
  );
  const stockists = stockistsData ?? [];
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, updateField, resetForm] = useFormFields(INITIAL_FORM);

  const openAddStockist = useCallback(() => setShowForm(true), []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");
      const name = form.name.trim();
      if (!name) {
        setFormError("Enter SACCO name.");
        return;
      }
      const lat = parseFloat(form.latitude);
      const lon = parseFloat(form.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        setFormError("Enter valid latitude and longitude.");
        return;
      }
      setSubmitting(true);
      try {
        await api.createFarmer({
          first_name: name,
          middle_name: undefined,
          last_name: "",
          phone: form.phone.trim() || undefined,
          latitude: lat,
          longitude: lon,
          is_stockist: false,
          is_sacco: true,
          is_group: false,
        });
        resetForm();
        setShowForm(false);
        await refetch();
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Failed to create stockist"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [form, resetForm, refetch]
  );

  if (loading) return <PageLoading message="Loading stockists…" />;
  if (error) return <PageError message={error} />;

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title="SACCOs"
        subtitle={pluralize(stockists.length, "SACCO") + " listed"}
        action={
          <Button color="yellow" variant="light" onClick={openAddStockist}>
            Add SACCO
          </Button>
        }
      />

      {showForm && (
        <Paper mt="md" p="md" radius="md" shadow="sm" withBorder>
          <Text size="lg" fw={600} mb="md">
            New SACCO
          </Text>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {formError && (
                <Alert color="red" variant="light">
                  {formError}
                </Alert>
              )}
              <TextInput
                label="SACCO name"
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
              <TextInput
                label="Phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
              <Box>
                <Text size="sm" fw={500} mb={4} component="label">
                  Location
                </Text>
                <MapPicker
                  latitude={
                    form.latitude ? parseFloat(form.latitude) : null
                  }
                  longitude={
                    form.longitude ? parseFloat(form.longitude) : null
                  }
                  onSelect={(lat, lng) => {
                    updateField("latitude", lat.toFixed(7));
                    updateField("longitude", lng.toFixed(7));
                  }}
                />
              </Box>
              <Group>
                <Button type="submit" color="yellow" loading={submitting}>
                  {submitting ? "Saving…" : "Add SACCO"}
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
        data={stockists}
        rowKey="id"
        columns={STOCKIST_COLUMNS}
        minWidth={400}
        emptyMessage="No SACCOs yet"
        pageSize={15}
      />
    </Box>
  );
}
