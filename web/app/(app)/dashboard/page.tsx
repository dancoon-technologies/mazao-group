"use client";

import { Box, Grid, Paper, Text, Title } from "@mantine/core";
import { useAsyncData } from "@/hooks/useAsyncData";
import { api } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { PageLoading, PageError } from "@/components/ui";
import { PAGE_BOX_MIN_WIDTH } from "@/lib/constants";

export default function DashboardPage() {
  const { data: stats, error, loading } = useAsyncData(
    () => api.getDashboardStats(),
    []
  );

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
    </Box>
  );
}
