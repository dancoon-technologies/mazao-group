"use client";

import { Paper, Table, Text, Pagination, Group } from "@mantine/core";
import { useState } from "react";
import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export type DataTableBreakpoint = "xs" | "sm" | "md" | "lg" | "xl";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  visibleFrom?: DataTableBreakpoint;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  /** Data rows */
  data: T[];
  /** Key on each row for React key (e.g. "id") */
  rowKey: keyof T;
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Minimum width for horizontal scroll */
  minWidth?: number;
  /** Message when data is empty */
  emptyMessage: string;
  /** Rows per page; omit to show all rows without pagination */
  pageSize?: number;
}

export function DataTable<T extends object>({
  data,
  rowKey,
  columns,
  minWidth = 400,
  emptyMessage,
  pageSize = 0,
}: DataTableProps<T>) {
  const size = pageSize > 0 ? pageSize : data.length || 1;
  const totalPages = Math.ceil(data.length / size);
  const [page, setPage] = useState(1);
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const start = (safePage - 1) * size;
  const paginatedData = pageSize > 0 ? data.slice(start, start + size) : data;

  return (
    <Paper
      mt="md"
      shadow="sm"
      radius="md"
      withBorder
      style={{ overflow: "hidden" }}
    >
      <Table.ScrollContainer minWidth={minWidth}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {columns.map((col) => (
                <Table.Th
                  key={col.key}
                  visibleFrom={col.visibleFrom}
                >
                  {col.label}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginatedData.map((row) => (
              <Table.Tr key={String(row[rowKey])}>
                {columns.map((col) => (
                  <Table.Td key={col.key} visibleFrom={col.visibleFrom}>
                    {col.render(row)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {data.length === 0 && <EmptyState message={emptyMessage} />}
      {pageSize > 0 && data.length > 0 && (
        <Group justify="space-between" p="sm" wrap="nowrap" gap="md">
          <Text size="sm" c="dimmed">
            Showing {start + 1}–{Math.min(start + size, data.length)} of {data.length}
          </Text>
          <Pagination
            total={totalPages}
            value={safePage}
            onChange={setPage}
            size="sm"
            withEdges
          />
        </Group>
      )}
    </Paper>
  );
}
