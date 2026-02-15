"use client";

import { Paper, Table } from "@mantine/core";
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
}

export function DataTable<T extends object>({
  data,
  rowKey,
  columns,
  minWidth = 400,
  emptyMessage,
}: DataTableProps<T>) {
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
            {data.map((row) => (
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
    </Paper>
  );
}
