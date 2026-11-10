// Adapted from saleor-dashboard: src/components/Datagrid/ColumnPicker/utils.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The parts of Saleor's helpers a static-only picker needs. Category navigation, dynamic-column
// lookup and the shadow of the action bar are left out with their features.
import type { AvailableColumn } from "../types";

export const filterEmptyColumn = (column: AvailableColumn) => column.title !== "";

export const isValidColumn = (column: AvailableColumn | undefined): column is AvailableColumn =>
  !!column;

export const byDuplicates = <T extends { id: string }>(column: T, index: number, self: T[]) =>
  self.findIndex((candidate) => candidate.id === column.id) === index;

export const isLastEnabledColumn = (
  columnIdToCheck: string,
  columnsToCheck: AvailableColumn[],
  selectedColumns: string[],
): boolean => {
  const enabledColumns = columnsToCheck.filter((column) => selectedColumns.includes(column.id));

  return enabledColumns.length === 1 && enabledColumns[0]?.id === columnIdToCheck;
};

export const mergeSelectedColumns = ({
  staticColumns,
  selectedColumns,
}: {
  staticColumns: AvailableColumn[];
  selectedColumns: string[];
}): AvailableColumn[] =>
  selectedColumns
    .map((columnId) => staticColumns.find((column) => column.id === columnId))
    .filter(isValidColumn);
