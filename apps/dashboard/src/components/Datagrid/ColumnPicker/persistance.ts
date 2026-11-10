// Adapted from saleor-dashboard: src/components/Datagrid/persistance/persistedColumn.ts and
// src/components/Datagrid/persistance/usePersistance.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Column widths and order, persisted per browser instead of Saleor's account metadata (our
// dashboard has no account-metadata mutation yet). The storage key is Saleor's historical
// `columnPickerSettings`; the shape mirrors its `grid_<name>` metadata value: RawColumn[].
import { useCallback, useState } from "react";

import type { AvailableColumn } from "../types";
import { byDuplicates, isValidColumn } from "./utils";

export const columnPersistanceStorageKey = "columnPickerSettings";

export interface RawColumn {
  id: string;
  w: number;
}

const isRawColumn = (value: unknown): value is RawColumn => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const raw = value as Partial<RawColumn>;

  return (
    typeof raw.id === "string" &&
    raw.id.length > 0 &&
    typeof raw.w === "number" &&
    Number.isFinite(raw.w) &&
    raw.w > 0
  );
};

const readStorage = (): Record<string, unknown> => {
  try {
    if (typeof localStorage === "undefined") {
      return {};
    }

    const stored = localStorage.getItem(columnPersistanceStorageKey);

    if (!stored) {
      return {};
    }

    const parsed: unknown = JSON.parse(stored);

    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const readPersistedColumns = (gridName: string): PersistedColumn[] => {
  const stored = readStorage()[gridName];

  if (!Array.isArray(stored)) {
    return [];
  }

  return stored.filter(isRawColumn).map((column) => PersistedColumn.fromRaw(column));
};

const writePersistedColumns = (gridName: string, columns: PersistedColumn[]): void => {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }

    const stored = readStorage();
    stored[gridName] = columns.map((column) => column.asRaw());
    localStorage.setItem(columnPersistanceStorageKey, JSON.stringify(stored));
  } catch {
    console.warn(`Could not save ${columnPersistanceStorageKey} to localStorage`);
  }
};

export class PersistedColumn {
  constructor(
    public id: string,
    public width: number,
  ) {}

  public static fromRaw(raw: RawColumn) {
    return new PersistedColumn(raw.id, raw.w);
  }

  public static withDefaultWidth(id: string) {
    return new PersistedColumn(id, 200);
  }

  public static fromAvailableColumn(column: AvailableColumn) {
    return new PersistedColumn(column.id, column.width);
  }

  public mergeWithAvailableColumn(column: AvailableColumn): AvailableColumn {
    return { ...column, width: this.width };
  }

  public asRaw(): RawColumn {
    return { id: this.id, w: this.width };
  }

  public identifier() {
    return this.id;
  }
}

export const useColumnPersistance = (gridName: string) => {
  const [columns, setColumns] = useState<PersistedColumn[]>(() => readPersistedColumns(gridName));
  const update = useCallback(
    (nextColumns: PersistedColumn[]) => {
      setColumns(nextColumns);
      writePersistedColumns(gridName, nextColumns);
    },
    [gridName],
  );

  return { columns, update };
};

const byColumnId = (columnId: string) => (persistedColumn: PersistedColumn) =>
  persistedColumn.identifier() === columnId;

export const visibleWithPersistance = (
  visibleColumns: AvailableColumn[],
  persistedColumns: PersistedColumn[],
): AvailableColumn[] => {
  const validColumns = visibleColumns.filter(isValidColumn);

  if (persistedColumns.length === 0) {
    return validColumns;
  }

  return validColumns.map((column) => {
    const persistedColumn = persistedColumns.find(byColumnId(column.id));

    return persistedColumn ? persistedColumn.mergeWithAvailableColumn(column) : column;
  });
};

export const selectedWithPersistance = (
  selectedColumns: string[],
  persistedColumns: PersistedColumn[],
  knownColumnIds: string[],
): string[] => {
  const known = new Set(knownColumnIds);
  const knownSelected = selectedColumns.filter((id) => known.has(id));

  if (persistedColumns.length === 0) {
    return knownSelected;
  }

  const persistedIds = persistedColumns
    .filter(byDuplicates)
    .map((column) => column.identifier())
    .filter((id) => known.has(id));
  const notPersistedYet = knownSelected.filter((id) => !persistedIds.includes(id));

  // Saleor keeps the user's order from persistence; a selected id without a persisted width
  // (e.g. new settings) keeps its settings position at the end.
  return [...persistedIds, ...notPersistedYet];
};
