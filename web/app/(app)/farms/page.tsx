"use client";

import { DataTable, type DataTableColumn, PageError, PageHeader, PageLoading } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useFormFields } from "@/hooks/useFormFields";
import { api } from "@/lib/api";
import { PAGE_BOX_MIN_WIDTH } from "@/lib/constants";
import { pluralize } from "@/lib/format";
import type { Farm, Farmer } from "@/lib/types";
import {
  Alert,
  Box,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";

const INITIAL_FARM_FORM = {
  farmer_id: "",
  county_id: "",
  sub_county_id: "",
  region_id: "",
  village: "",
  latitude: "",
  longitude: "",
  plot_size: "",
  crop_type: "",
};

function farmColumns(farmers: Farmer[]): DataTableColumn<Farm>[] {
  return [
    {
      key: "farmer",
      label: "Farmer",
      render: (f) => {
        const farmer = farmers.find((x) => x.id === f.farmer);
        return <Text size="sm" fw={500}>{farmer?.display_name ?? f.farmer ?? "—"}</Text>;
      },
    },
    { key: "village", label: "Village", render: (f) => <Text size="sm" fw={500}>{f.village}</Text> },
    { key: "county", label: "County", render: (f) => <Text size="sm" c="dimmed">{f.county}</Text> },
    { key: "sub_county", label: "Sub-county", render: (f) => <Text size="sm" c="dimmed">{f.sub_county}</Text> },
    { key: "plot_size", label: "Plot", visibleFrom: "md", render: (f) => <Text size="sm" c="dimmed">{f.plot_size || "—"}</Text> },
    { key: "crop_type", label: "Crop", visibleFrom: "md", render: (f) => <Text size="sm" c="dimmed">{f.crop_type || "—"}</Text> },
  ];
}

export default function FarmsPage() {
  useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farmerFilter, setFarmerFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, updateField, resetForm] = useFormFields(INITIAL_FARM_FORM);

  const loadFarms = useCallback(async () => {
    const data = await api.getFarms(farmerFilter ?? undefined);
    setFarms(data);
  }, [farmerFilter]);

  const loadFarmers = useCallback(async () => {
    const data = await api.getFarmers();
    setFarmers(data);
  }, []);

  const { data: locationsData } = useAsyncData(
    (signal) => api.getLocations({ signal }),
    []
  );
  const locations = locationsData ?? { regions: [], counties: [], sub_counties: [] };

  const regionOptions = useMemo(() => {
    return locations.regions.map((r) => ({ value: String(r.id), label: r.name }));
  }, [locations.regions]);

  const countyOptions = useMemo(() => {
    return locations.counties.map((c) => ({ value: String(c.id), label: c.name }));
  }, [locations.counties]);

  const subCountyOptions = useMemo(() => {
    if (!form.county_id) return [];
    return locations.sub_counties
      .filter((s) => s.county_id === Number(form.county_id))
      .map((s) => ({ value: String(s.id), label: s.name }));
  }, [locations.sub_counties, form.county_id]);


  useEffect(() => {
    setError("");
    setLoading(true);
    Promise.all([loadFarms(), loadFarmers()])
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [loadFarms, loadFarmers]);

  const farmerOptions = farmers.map((f) => ({ value: f.id, label: f.display_name }));

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");
      if (!form.farmer_id || !form.region_id || !form.county_id || !form.sub_county_id || !form.village.trim()) {
        setFormError("Farmer, county, sub-county and village are required.");
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
        await api.createFarm({
          farmer_id: form.farmer_id,
          county_id: form.county_id,
          sub_county_id: form.sub_county_id,
          village: form.village.trim(),
          latitude: lat,
          longitude: lon,
          plot_size: form.plot_size.trim() || undefined,
          crop_type: form.crop_type.trim() || undefined,
        });
        resetForm();
        setShowForm(false);
        await loadFarms();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to create farm");
      } finally {
        setSubmitting(false);
      }
    },
    [form, resetForm, loadFarms]
  );

  if (loading) return <PageLoading message="Loading farms…" />;
  if (error) return <PageError message={error} />;

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title="Farms"
        subtitle={pluralize(farms.length, "farm") + " listed"}
        action={
          <Group>
            <Select
              placeholder="All farmers"
              clearable
              data={farmerOptions}
              value={farmerFilter}
              onChange={setFarmerFilter}
              style={{ minWidth: 200 }}
            />
            <Button color="green" onClick={() => setShowForm(true)}>
              Add farm
            </Button>
          </Group>
        }
      />

      {showForm && (
        <Paper mt="md" p="md" radius="md" shadow="sm" withBorder>
          <Text size="lg" fw={600} mb="md">
            New farm (farming land)
          </Text>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {formError && (
                <Alert color="red" variant="light">
                  {formError}
                </Alert>
              )}
              <Select
                label="Farmer"
                required
                placeholder="Select farmer"
                data={farmerOptions}
                value={form.farmer_id || null}
                onChange={(v) => updateField("farmer_id", v ?? "")}
              />
              <Select
                label="Region"
                placeholder="Search region…"
                searchable
                clearable
                data={regionOptions}
                value={form.region_id || null}
                onChange={(v) => updateField("region_id", v ?? "")}
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
              <TextInput
                label="Village"
                required
                value={form.village}
                onChange={(e) => updateField("village", e.target.value)}
                placeholder="Village or area"
              />
              <Group grow>
                <TextInput
                  label="Latitude"
                  required
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => updateField("latitude", e.target.value)}
                  placeholder="-1.2921"
                />
                <TextInput
                  label="Longitude"
                  required
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => updateField("longitude", e.target.value)}
                  placeholder="36.8219"
                />
              </Group>
              <TextInput
                label="Plot size (optional)"
                value={form.plot_size}
                onChange={(e) => updateField("plot_size", e.target.value)}
                placeholder="e.g. 2 acres"
              />
              <TextInput
                label="Crop type (optional)"
                value={form.crop_type}
                onChange={(e) => updateField("crop_type", e.target.value)}
                placeholder="e.g. Maize"
              />
              <Group>
                <Button type="submit" color="green" loading={submitting}>
                  {submitting ? "Saving…" : "Add farm"}
                </Button>
                <Button type="button" variant="default" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      )}

      <DataTable
        data={farms}
        rowKey="id"
        columns={farmColumns(farmers)}
        minWidth={500}
        emptyMessage="No farms found"
        pageSize={15}
      />
    </Box>
  );
}
