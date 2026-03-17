"use client";

import {
  Badge,
  Box,
  Button,
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
import { getLabelsFromOptions, pluralLocation } from "@/lib/options";

const FarmsMapView = dynamic(
  () => import("@/components/FarmsMapView").then((m) => ({ default: m.FarmsMapView })),
  { ssr: false }
);

export default function FarmerDetailPage() {
  useAuth();
  const params = useParams<{ id: string }>();
  const farmerId = (typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : params?.id) ?? "";

  const { data: farmer, error: farmerError, loading: farmerLoading } = useAsyncData(
    (signal) => (farmerId ? api.getFarmer(farmerId, { signal }) : Promise.reject(new Error("Missing farmer id"))),
    [farmerId]
  );
  const { data: farmsData = [] } = useAsyncData(
    (signal) => (farmerId ? api.getFarms(farmerId, { signal }) : Promise.resolve([])),
    [farmerId]
  );
  const { data: visitsData = [] } = useAsyncData(
    (signal) => (farmerId ? api.getVisits({ farmer: farmerId }, { signal }) : Promise.resolve([])),
    [farmerId]
  );
  const { data: optionsData } = useAsyncData(
    (signal) => api.getOptions({ signal }),
    []
  );

  const farms = useMemo(() => (Array.isArray(farmsData) ? farmsData : []), [farmsData]);
  const visits = useMemo(() => (Array.isArray(visitsData) ? visitsData : []), [visitsData]);
  const labels = useMemo(() => getLabelsFromOptions(optionsData), [optionsData]);
  const locationPlural = pluralLocation(labels.location);

  const productsSold = useMemo(() => {
    const byProduct: Record<string, { name: string; code?: string; unit?: string; total: number; visits: number }> = {};
    for (const v of visits) {
      const lines = v.product_lines ?? [];
      for (const line of lines) {
        const qty = parseFloat(line.quantity_sold || "0") || 0;
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

  const farmColumns: DataTableColumn<Farm>[] = useMemo(
    () => [
      {
        key: "village",
        label: "Village",
        render: (f) => <Text size="sm" c="dimmed">{f.village}</Text>,
      },
      { key: "county", label: "County", render: (f) => <Text size="sm" c="dimmed">{f.county || "—"}</Text> },
      { key: "sub_county", label: "Sub-county", render: (f) => <Text size="sm" c="dimmed">{f.sub_county || "—"}</Text> },
      { key: "plot_size", label: "Plot", render: (f) => <Text size="sm" c="dimmed">{f.plot_size || "—"}</Text> },
      { key: "crop_type", label: "Crop", render: (f) => <Text size="sm" c="dimmed">{f.crop_type || "—"}</Text> },
    ],
    []
  );

  const visitColumns: DataTableColumn<Visit>[] = useMemo(
    () => [
      {
        key: "created_at",
        label: "Date",
        render: (v) => <Text size="sm" c="dimmed">{formatDateTime(v.created_at)}</Text>,
      },
      {
        key: "farm",
        label: labels.location,
        render: (v) => <Text size="sm">{v.farm_display_name ?? "—"}</Text>,
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
    [labels.location]
  );

  if (!farmerId) return <PageError message="Missing farmer id." />;
  if (farmerLoading) return <PageLoading message={`Loading ${labels.partner.toLowerCase()}…`} />;
  if (farmerError || !farmer) {
    const message = farmerError || `${labels.partner} not found.`;
    return <PageError message={message} />;
  }

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <PageHeader
        title={farmer.display_name}
        subtitle={farmer.phone ? `Phone: ${farmer.phone}` : farmer.crop_type ? farmer.crop_type : undefined}
        badges={
          farmer.is_stockist
            ? [{ label: "Stockist", color: "yellow" as const }]
            : undefined
        }
        action={
          <Button variant="light" component={Link} href={ROUTES.FARMERS}>
            Back to {labels.partner}s
          </Button>
        }
      />

      <Tabs defaultValue="farms" mt="md">
        <Tabs.List>
          <Tabs.Tab value="farms">{locationPlural} ({farms.length})</Tabs.Tab>
          <Tabs.Tab value="visits">Visits ({visits.length})</Tabs.Tab>
          <Tabs.Tab value="map">Map</Tabs.Tab>
          <Tabs.Tab value="products">Products sold ({productsSold.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="farms" pt="md">
          <div>
            <Title order={3} size="h4" mb="md">
              {locationPlural}
            </Title>
            {farms.length === 0 ? (
              <Text size="sm" c="dimmed">No {labels.location.toLowerCase()}s recorded for this {labels.partner.toLowerCase()} yet.</Text>
            ) : (
              <DataTable
                data={farms}
                rowKey="id"
                columns={farmColumns}
                minWidth={500}
                emptyMessage={`No ${labels.location.toLowerCase()}s`}
                pageSize={15}
              />
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="visits" pt="md">
          <div>
            <Title order={3} size="h4" mb="md">
              Visits to this {labels.partner.toLowerCase()}
            </Title>
            {visits.length === 0 ? (
              <Text size="sm" c="dimmed">No visits recorded for this {labels.partner.toLowerCase()} yet.</Text>
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
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="map" pt="md">
          <div>
            <Title order={3} size="h4" mb="md">
              Map — {labels.partner}&apos;s {locationPlural}
            </Title>
            <Text size="sm" c="dimmed" mb="md">
              All {labels.location.toLowerCase()} locations for this {labels.partner.toLowerCase()}.
            </Text>
            <FarmsMapView
              farms={farms}
              locationLabel={labels.location}
            />
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="products" pt="md">
          <div>
            <Title order={3} size="h4" mb="md">
              Products sold to this {labels.partner.toLowerCase()}
            </Title>
            {productsSold.length === 0 ? (
              <Text size="sm" c="dimmed">No products sold to this {labels.partner.toLowerCase()} yet.</Text>
            ) : (
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Total sold</Table.Th>
                    <Table.Th>Visits</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {productsSold.map((p) => (
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
          </div>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
