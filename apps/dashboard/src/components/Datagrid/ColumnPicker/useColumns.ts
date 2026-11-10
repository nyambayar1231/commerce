// Adapted from saleor-dashboard: src/components/Datagrid/ColumnPicker/useColumns.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The single source of truth for the datagrid and its column picker. Static columns only: the
// dynamic-column categories, their persistence and the special "empty" column are left out with
// the dynamic column picker.
import type { GridColumn } from "@glideapps/glide-data-grid";
import { useCallback, useMemo, useState } from "react";

import type { AvailableColumn } from "../types";
import {
  PersistedColumn,
  selectedWithPersistance,
  useColumnPersistance,
  visibleWithPersistance,
} from "./persistance";
import { mergeSelectedColumns } from "./utils";

interface UseColumnsProps {
  gridName: string;
  staticColumns: AvailableColumn[];
  selectedColumns: string[];
  onSave: (columns: string[]) => void;
  mapColumnsOnSave?: (columns: string[]) => string[];
  newColumnPosition?: "start" | "end";
}

export const useColumns = ({
  gridName,
  staticColumns,
  selectedColumns: _selectedColumns,
  onSave: handleSave,
  mapColumnsOnSave,
  newColumnPosition = "start",
}: UseColumnsProps) => {
  const { columns: persistedColumns, update } = useColumnPersistance(gridName);
  const selectedColumns = useMemo(() => {
    const columns = selectedWithPersistance(
      _selectedColumns,
      persistedColumns,
      staticColumns.map((column) => column.id),
    );

    return mapColumnsOnSave ? mapColumnsOnSave(columns) : columns;
  }, [_selectedColumns, persistedColumns, mapColumnsOnSave, staticColumns]);

  const visibleColumns = useMemo(
    () =>
      visibleWithPersistance(
        mergeSelectedColumns({ staticColumns, selectedColumns }),
        persistedColumns,
      ),
    [staticColumns, selectedColumns, persistedColumns],
  );

  const [recentlyAddedColumn, setRecentlyAddedColumn] = useState<string | null>(null);

  const onSave = (columnsIds: string[]) => {
    const normalizedColumnIds = mapColumnsOnSave ? mapColumnsOnSave(columnsIds) : columnsIds;
    const columns = normalizedColumnIds.map((columnId) => {
      const visibleColumn = visibleColumns.find((column) => column.id === columnId);

      if (visibleColumn) {
        return PersistedColumn.fromAvailableColumn(visibleColumn);
      }

      const persistedEquivalent = persistedColumns.find(
        (persistedColumn) => persistedColumn.identifier() === columnId,
      );

      return persistedEquivalent ?? PersistedColumn.withDefaultWidth(columnId);
    });

    update(columns);
    handleSave(normalizedColumnIds);
  };

  const onMove = useCallback(
    (startIndex: number, endIndex: number): void => {
      const movedColumn = visibleColumns[startIndex];

      if (!movedColumn) {
        return;
      }

      const reorderedColumns = [...visibleColumns];

      reorderedColumns.splice(startIndex, 1);
      reorderedColumns.splice(endIndex, 0, movedColumn);
      update(reorderedColumns.map((column) => PersistedColumn.fromAvailableColumn(column)));
    },
    [visibleColumns, update],
  );

  const onResize = useCallback(
    (column: GridColumn, newSize: number): void => {
      update(
        visibleColumns.map((visibleColumn) =>
          PersistedColumn.fromAvailableColumn(
            visibleColumn.id === column.id ? { ...visibleColumn, width: newSize } : visibleColumn,
          ),
        ),
      );
    },
    [visibleColumns, update],
  );

  const onToggle = (columnId: string) => {
    const isAdded = !selectedColumns.includes(columnId);

    if (isAdded) {
      onSave(
        newColumnPosition === "end"
          ? [...selectedColumns, columnId]
          : [columnId, ...selectedColumns],
      );
      setRecentlyAddedColumn(columnId);
    } else {
      onSave(selectedColumns.filter((id) => id !== columnId));
    }
  };

  const onClearRecentlyAddedColumn = () => setRecentlyAddedColumn(null);

  return {
    handlers: {
      onMove,
      onResize,
      onToggle,
      onClearRecentlyAddedColumn,
    },
    visibleColumns,
    staticColumns,
    selectedColumns,
    recentlyAddedColumn,
  };
};
