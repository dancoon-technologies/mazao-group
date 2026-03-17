"use client";

import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import type { Farm, Farmer, Visit } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { DataTable, type DataTableColumn, PageLoading, PageError, PageHeader } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROUTES } from "@/lib/constants";
import { formatDateTime, formatActivityType, formatActivityTypes } from "@/lib/format";
import { getLabelsFromOptions } from "@/lib/options";

const FarmsMapView = dynamic(
  () => import("@/components/FarmsMapView").then((m) => ({ default: m.FarmsMapView })),
  { ssr: false }
);

export default function FarmDetailPage() {
  useAuth();
  const params = useParams<{ id: string }>();
  const farmId = params?.id ?? "";

  const { data: farm, error: farmError, loading: farmLoading } = useAsyncData(
    (signal) => (farmId ? api.getFarm(farmId, { signal }) : Promise.reject(new Error("Missing farm id"))),
    [farmId]
  );
  const { data: visitsData = [] } = useAsyncData(
    (signal) => (farmId ? api.getVisits({ farm: farmId }, { signal }) : Promise.resolve([])),
    [farmId]
  );
  const { data: farmersData = [] } = useAsyncData(
    (signal) => api.getFarmers({ signal }),
    []
  );
  const { data: optionsData } = useAsyncData(
    (signal) => api.getOptions({ signal }),
    []
  );
  const { data: farmerFarmsData = [] } = useAsyncData(
    (signal) => (farm?.farmer ? api.getFarms(farm.farmer, { signal }) : Promise.resolve([])),
    [farm?.farmer]
  );

  const visits = useMemo(() => (Array.isArray(visitsData) ? visitsData : []), [visitsData]);
  const farmers = useMemo(() => (Array.isArray(farmersData) ? farmersData : []), [farmersData]);
  const labels = useMemo(() => getLabelsFromOptions(optionsData), [optionsData]);
  const farmerFarms = useMemo(() => (Array.isArray(farmerFarmsData) ? farmerFarmsData : []), [farmerFarmsData]);
  const farmerDisplayName = useMemo(() => {
    if (!farm?.farmer) return "—";
    const f = farmers.find((x) => x.id === farm.farmer);
    return f?.display_name ?? farm.farmer;
  }, [farm?.farmer, farmers]);

  const productsGiven = useMemo(() => {
    const byProduct: Record<string, { name: string; code?: string; unit?: string; total: number; visits: number }> = {};
    for (const v of visits) {
      const lines = v.product_lines ?? [];
      for (const line of lines) {
        const qty = parseFloat(line.quantity_given || "0") || 0;
        if (qty <= 0) continue;
        const key = line.product_id;
        if (!byProduct[key]) {
          byProduct[key] = {
            name: line.product_name ?? "Product",
            code: line.product_code,
            unit: line.product_unit,
            total: 0,
            visits: 0,
          };
        }
        byProduct[key].total += qty;
        byProduct[key].visits += 1;
      }
    }
    return Object.entries(byProduct).map(([id, data]) => ({ id, ...data }));
  }, [visits]);

  const visitColumns: DataTableColumn<Visit>[] = useMemo(
    () => [
      {
        key: "created_at",
        label: "Date",
        render: (v) => <Text size="sm" c="dimmed">{formatDateTime(v.created_at)}</Text>,
      },
      {
        key: "officer",
        label: "Officer",
        render: (v) => <Text size="sm">{v.officer_display_name ?? v.officer_email ?? v.officer}</Text>,
      },
      {
        key: "activity_type",
        label: "Activity",
        render: (v) => (
          <Text size="sm">
            {formatActivityTypes(v.activity_types?.length ? v.activity_types : undefined) ||
              formatActivityType(v.activity_type ?? "")}
          </Text>
        ),
      },
      {
        key: "verification_status",
        label: "Status",
        render: (v) => (
          <Badge
            color={
              v.verification_status === "verified"
                ? "green"
                : v.verification_status === "rejected"
                  ? "red"
                  : "yellow"
            }
            variant="light"
            size="sm"
          >
            {v.verification_status === "pending"
              ? "Pending"
              : v.verification_status === "verified"
                ? "Verified"
                : v.verification_status === "rejected"
                  ? "Rejected"
                  : v.verification_status}
          </Badge>
        ),
      },
    ],
    []
  );

  if (!farmId) return <PageError message="Missing farm id." />;
  if (farmLoading) return <PageLoading message="Loading farm…" />;
  if (farmError || !farm) return <PageError message={farmError ?? "Farm not found."} />;

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title={farm.village}
        subtitle={[farm.sub_county, farm.county].filter(Boolean).join(", ") || undefined}
        action={
          <Button variant="light" component={Link} href={ROUTES.FARMS}>
            Back to {labels.location}s
          </Button>
        }
      />

      <Tabs defaultValue="farm" mt="md">
        <Tabs.List>
          <Tabs.Tab value="farm">{labels.location}</Tabs.Tab>
          <Tabs.Tab value="map">Map</Tabs.Tab>
          <Tabs.Tab value="visits">Visits ({visits.length})</Tabs.Tab>
          <Tabs.Tab value="products">Products given ({productsGiven.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="farm" pt="md">
          <Paper p="lg" radius="md" withBorder>
            <Title order={3} size="h4" mb="md">
              {labels.location} details
            </Title>
            <Stack gap="sm">
              <Group wrap="wrap" gap="xl">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Village</Text>
                  <Text size="sm">{farm.village || "—"}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>County</Text>
                  <Text size="sm">{farm.county || "—"}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Sub-county</Text>
                  <Text size="sm">{farm.sub_county || "—"}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{labels.partner}</Text>
                  <Text size="sm">{farmerDisplayName}</Text>
                </Box>
                {(farm.plot_size || farm.crop_type) && (
                  <>
                    {farm.plot_size && (
                      <Box>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Plot size</Text>
                        <Text size="sm">{farm.plot_size}</Text>
                      </Box>
                    )}
                    {farm.crop_type && (
                      <Box>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Crop type</Text>
                        <Text size="sm">{farm.crop_type}</Text>
                      </Box>
                    )}
                  </>
                )}
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Coordinates</Text>
                  <Text size="sm">{farm.latitude}, {farm.longitude}</Text>
                </Box>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="map" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Title order={3} size="h4" mb="md">
              Map — {labels.partner}&apos;s {labels.location}s
            </Title>
            <Text size="sm" c="dimmed" mb="md">
              All {labels.location.toLowerCase()}s belonging to this {labels.partner.toLowerCase()}. The current one is highlighted in green.
            </Text>
            <FarmsMapView
              farms={farmerFarms}
              currentFarmId={farmId}
              locationLabel={labels.location}
            />
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="visits" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Title order={3} size="h4" mb="md">
              Visits to this {labels.location.toLowerCase()}
            </Title>
            {visits.length === 0 ? (
              <Text size="sm" c="dimmed">No visits recorded for this {labels.location.toLowerCase()} yet.</Text>
            ) : (
              <DataTable
                data={visits}
                rowKey="id"
                columns={visitColumns}
                minWidth={500}
                emptyMessage="No visits"
                pageSize={15}
              />
            )}
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="products" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Title order={3} size="h4" mb="md">
              Products given at this {labels.location.toLowerCase()}
            </Title>
            {productsGiven.length === 0 ? (
              <Text size="sm" c="dimmed">No products given at this {labels.location.toLowerCase()} yet.</Text>
            ) : (
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Total given</Table.Th>
                    <Table.Th>Visits</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {productsGiven.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{p.name}</Text>
                        {(p.code || p.unit) && (
                          <Text size="xs" c="dimmed">{[p.code, p.unit].filter(Boolean).join(" · ")}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {p.total}
                        {p.unit ? ` ${p.unit}` : ""}
                      </Table.Td>
                      <Table.Td>{p.visits}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
