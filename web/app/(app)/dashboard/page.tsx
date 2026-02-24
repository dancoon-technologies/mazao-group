"use client";

import { Anchor, Badge, Box, Grid, Paper, Table, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import type { DashboardStats, Visit } from "@/lib/types";
import { PageLoading, PageError } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH, ROUTES } from "@/lib/constants";
import { formatDateTime, formatActivityType } from "@/lib/format";

export default function DashboardPage() {
  const { data: stats, error, loading } = useAsyncData(
    () => api.getDashboardStats(),
    []
  );
  const { data: recentVisitsData } = useAsyncData(
    () => api.getVisits(),
    []
  );
  const recentVisits: Visit[] = (recentVisitsData ?? []).slice(0, 5);

  if (loading) return <PageLoading message="Loading dashboard…" />;
  if (error) return <PageError message={error} />;
  if (!stats) return null;

  const cards = [
    { label: "Visits today", value: stats.visits_today },
    { label: "Visits this month", value: stats.visits_this_month },
    { label: "Active officers", value: stats.active_officers },
  ];

  return (
    <Box style={{ minWidth: PAGE_BOX_MIN_WIDTH }}>
      <Title order={1} size="h2">
        Dashboard
      </Title>
      <Text size="sm" c="dimmed" mt="xs">
        Overview of field visit activity
      </Text>
      <Grid mt="md" gutter="md">
        {cards.map((card) => (
          <Grid.Col key={card.label} span={{ base: 12, sm: 4 }}>
            <Paper p="md" shadow="sm" radius="md" withBorder>
              <Text size="sm" fw={500} c="dimmed">
                {card.label}
              </Text>
              <Text size="xl" fw={600} mt="sm">
                {card.value}
              </Text>
            </Paper>
          </Grid.Col>
        ))}
      </Grid>

      {recentVisits.length > 0 && (
        <Paper mt="xl" p="md" shadow="sm" radius="md" withBorder>
          <Text size="md" fw={600} mb="sm">
            Recent visits
          </Text>
          <Table.ScrollContainer minWidth={400}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Farmer</Table.Th>
                  <Table.Th>Activity</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentVisits.map((v) => (
                  <Table.Tr key={v.id}>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {formatDateTime(v.created_at)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{v.farmer_display_name ?? v.farmer}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {formatActivityType(v.activity_type ?? "")}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={v.verification_status === "verified" ? "green" : "red"}
                        variant="light"
                        size="sm"
                      >
                        {v.verification_status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Text size="sm" mt="sm">
            <Anchor component={Link} href={ROUTES.VISITS}>
              View all visits →
            </Anchor>
          </Text>
        </Paper>
      )}
    </Box>
  );
}
