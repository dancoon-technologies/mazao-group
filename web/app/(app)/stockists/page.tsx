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
  first_name: "",
  middle_name: "",
  last_name: "",
  phone: "",
  latitude: "",
  longitude: "",
};

export default function StockistsPage() {
  const { data: stockistsData, error, loading, refetch } = useAsyncData(
    (signal) => api.getFarmers({ signal, is_stockist: true }),
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
      const first = form.first_name.trim();
      const last = form.last_name.trim();
      if (!first || !last) {
        setFormError("Enter first and last name.");
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
          first_name: first,
          middle_name: form.middle_name.trim() || undefined,
          last_name: last,
          phone: form.phone.trim() || undefined,
          latitude: lat,
          longitude: lon,
          is_stockist: true,
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
        title="Stockists"
        subtitle={pluralize(stockists.length, "stockist") + " listed"}
        action={
          <Button color="yellow" variant="light" onClick={openAddStockist}>
            Add stockist
          </Button>
        }
      />

      {showForm && (
        <Paper mt="md" p="md" radius="md" shadow="sm" withBorder>
          <Text size="lg" fw={600} mb="md">
            New stockist
          </Text>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {formError && (
                <Alert color="red" variant="light">
                  {formError}
                </Alert>
              )}
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                  <TextInput
                    label="First name"
                    required
                    value={form.first_name}
                    onChange={(e) => updateField("first_name", e.target.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                  <TextInput
                    label="Middle name"
                    value={form.middle_name}
                    onChange={(e) => updateField("middle_name", e.target.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                  <TextInput
                    label="Last name"
                    required
                    value={form.last_name}
                    onChange={(e) => updateField("last_name", e.target.value)}
                  />
                </Grid.Col>
              </Grid>
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
                  {submitting ? "Saving…" : "Add stockist"}
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
        emptyMessage="No stockists yet"
        pageSize={15}
      />
    </Box>
  );
}
