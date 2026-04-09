"use client";

import {
  Alert,
  Box,
  Button,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Tabs,
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

const FARMER_COLUMNS: DataTableColumn<Farmer>[] = [
  {
    key: "name",
    label: "Name",
    render: (f) => (
      <Link
        href={`/farmers/${f.id}`}
        style={{ color: "var(--mantine-color-green-7)", fontWeight: 500, textDecoration: "none", wordBreak: "break-word" }}
      >
        {f.display_name}
      </Link>
    ),
  },
  {
    key: "type",
    label: "Type",
    render: (f) => (
      <Text size="sm" c="dimmed">
        {f.is_sacco
          ? "SACCO"
          : f.is_stockist
            ? "Stockist"
            : f.is_group
              ? "Farmers group"
              : "Individual farmer"}
      </Text>
    ),
  },
  {
    key: "phone",
    label: "Phone",
    render: (f) => <Text size="sm" c="dimmed">{f.phone || "—"}</Text>,
  },
];

const INITIAL_FARMER_FORM = {
  mode: "individual" as "individual" | "group" | "stockist" | "sacco",
  first_name: "",
  middle_name: "",
  last_name: "",
  phone: "",
  latitude: "",
  longitude: "",
};

export default function FarmersPage() {
  const { data: farmersData, error, loading, refetch } = useAsyncData((signal) => api.getFarmers({ signal }), []);
  const farmers = farmersData ?? [];
  const [activeTab, setActiveTab] = useState<"all" | "individual" | "group" | "stockist" | "sacco">("all");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, updateField, resetForm] = useFormFields(INITIAL_FARMER_FORM);

  const filteredCustomers = useCallback(
    (list: Farmer[]) => {
      if (activeTab === "all") return list;
      if (activeTab === "individual") {
        return list.filter((f) => !f.is_group && !f.is_stockist && !f.is_sacco);
      }
      if (activeTab === "group") return list.filter((f) => Boolean(f.is_group));
      if (activeTab === "stockist") return list.filter((f) => Boolean(f.is_stockist));
      return list.filter((f) => Boolean(f.is_sacco));
    },
    [activeTab]
  );

  const visibleCustomers = filteredCustomers(farmers);

  const openAddFarmer = useCallback(() => {
    if (activeTab === "group" || activeTab === "stockist" || activeTab === "sacco" || activeTab === "individual") {
      updateField("mode", activeTab);
    }
    setShowForm(true);
  }, [activeTab, updateField]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");
      const isGroup = form.mode === "group";
      const isStockist = form.mode === "stockist";
      const isSacco = form.mode === "sacco";
      const first = form.first_name.trim();
      const last = form.last_name.trim();
      if (!first) {
        setFormError(
          isGroup
            ? "Enter farmers group name."
            : isSacco
              ? "Enter SACCO name."
              : isStockist
                ? "Enter stockist name."
                : "Enter first name."
        );
        return;
      }
      if (!isGroup && !isStockist && !isSacco && !last) {
        setFormError("Enter last name.");
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
          middle_name: isGroup || isStockist || isSacco ? undefined : form.middle_name.trim() || undefined,
          last_name: isGroup || isStockist || isSacco ? "" : last,
          phone: form.phone.trim() || undefined,
          latitude: lat,
          longitude: lon,
          is_stockist: isStockist,
          is_sacco: isSacco,
          is_group: isGroup,
        });
        resetForm();
        setShowForm(false);
        await refetch();
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Failed to create customer"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [form, resetForm, refetch]
  );

  if (loading) return <PageLoading message="Loading customers…" />;
  if (error) return <PageError message={error} />;

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title="Customers"
        subtitle={pluralize(visibleCustomers.length, "customer") + " listed"}
        action={
          <Button color="green" variant="light" onClick={openAddFarmer}>
            Add customer
          </Button>
        }
      />

      <Tabs value={activeTab} onChange={(v) => setActiveTab((v as "all" | "individual" | "group" | "stockist" | "sacco") ?? "all")} mt="md">
        <Tabs.List>
          <Tabs.Tab value="all">All</Tabs.Tab>
          <Tabs.Tab value="individual">Individual</Tabs.Tab>
          <Tabs.Tab value="group">Farmer groups</Tabs.Tab>
          <Tabs.Tab value="stockist">Stockists</Tabs.Tab>
          <Tabs.Tab value="sacco">SACCOs</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {showForm && (
        <Paper mt="md" p="md" radius="md" shadow="sm" withBorder>
          <Text size="lg" fw={600} mb="md">
            New customer
          </Text>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {formError && (
                <Alert color="red" variant="light">
                  {formError}
                </Alert>
              )}
              <SegmentedControl
                value={form.mode}
                onChange={(value) => updateField("mode", value as "individual" | "group" | "stockist" | "sacco")}
                data={[
                  { label: "Individual", value: "individual" },
                  { label: "Farmers group", value: "group" },
                  { label: "Stockist", value: "stockist" },
                  { label: "SACCO", value: "sacco" },
                ]}
              />
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                  <TextInput
                    label={
                      form.mode === "group"
                        ? "Group name"
                        : form.mode === "sacco"
                          ? "SACCO name"
                          : form.mode === "stockist"
                            ? "Stockist name"
                            : "First name"
                    }
                    required
                    value={form.first_name}
                    onChange={(e) => updateField("first_name", e.target.value)}
                  />
                </Grid.Col>
                {form.mode === "individual" ? (
                  <>
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
                  </>
                ) : null}
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
                <Button type="submit" color="green" loading={submitting}>
                  {submitting ? "Saving…" : "Add customer"}
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
        data={visibleCustomers}
        rowKey="id"
        columns={FARMER_COLUMNS}
        minWidth={400}
        emptyMessage="No customers yet"
        pageSize={15}
      />
    </Box>
  );
}
