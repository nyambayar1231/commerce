// Adapted from saleor-dashboard: src/components/Datagrid/hooks/useDatagridChange.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's cell-edit tracking: every edited cell is kept as a change { row, column id, data } in a
// ref the page owns (via DatagridChangeStateContext), and onChange hears each edit. Only edits are
// tracked: Saleor's added/removed rows and the trailing "ghost" row (bulk-edit grids) come with
// their first user.
import type { EditableGridCell, Item } from "@glideapps/glide-data-grid";
import { createContext, type MutableRefObject, useCallback, useContext, useRef } from "react";

import type { AvailableColumn } from "../types";

export interface DatagridChange {
  data: unknown;
  row: number;
  column: string;
}

export interface DatagridChangeOpts {
  updates: DatagridChange[];
  currentUpdate?: DatagridChange;
}

export type OnDatagridChange = (
  opts: DatagridChangeOpts,
  setMarkCellsDirty: (areCellsDirty: boolean) => void,
) => void;

export interface UseDatagridChangeState {
  changes: MutableRefObject<DatagridChange[]>;
  clear: () => void;
}

export function useDatagridChangeState(): UseDatagridChangeState {
  const changes = useRef<DatagridChange[]>([]);
  const clear = useCallback(() => {
    changes.current = [];
  }, []);

  return { changes, clear };
}

export const DatagridChangeStateContext = createContext<UseDatagridChangeState | undefined>(
  undefined,
);

/** A grid without a provider (read-only lists) keeps its own, unused, change list. */
const useDatagridChangeStateContext = (): UseDatagridChangeState => {
  const fallback = useDatagridChangeState();

  return useContext(DatagridChangeStateContext) ?? fallback;
};

export function useDatagridChange(
  availableColumns: readonly AvailableColumn[],
  onChange?: OnDatagridChange,
  setMarkCellsDirty?: (areCellsDirty: boolean) => void,
) {
  const { changes } = useDatagridChangeStateContext();
  const getChangeIndex = useCallback(
    (column: string, row: number): number =>
      changes.current.findIndex((change) => change.column === column && change.row === row),
    [changes],
  );
  const onCellEdited = useCallback(
    ([column, row]: Item, newValue: EditableGridCell): void => {
      const columnId = availableColumns[column]?.id;

      if (!columnId) {
        return;
      }

      const existingIndex = getChangeIndex(columnId, row);
      const update: DatagridChange = { data: newValue.data, column: columnId, row };

      changes.current =
        existingIndex === -1
          ? [...changes.current, update]
          : changes.current.map((change, index) => (index === existingIndex ? update : change));
      onChange?.({ updates: changes.current, currentUpdate: update }, (dirty) =>
        setMarkCellsDirty?.(dirty),
      );
    },
    [availableColumns, changes, getChangeIndex, onChange, setMarkCellsDirty],
  );

  return { changes, getChangeIndex, onCellEdited };
}
