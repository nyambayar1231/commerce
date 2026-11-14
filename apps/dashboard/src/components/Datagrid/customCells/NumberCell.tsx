// Adapted from saleor-dashboard: src/components/Datagrid/customCells/NumberCell.tsx and
// useDatagridNumericEdit.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's editable number cell: drawn right-aligned in the UI locale; double-click, Enter or a
// typed digit opens a number input over the cell (a typed digit replaces the value, Enter/F2
// selects it, empty stays empty rather than 0), and pasting a number fills it. Saleor's "percent"
// format comes with its first user.
import {
  type CustomCell,
  type CustomRenderer,
  GridCellKind,
  getMiddleCenterBias,
  type ProvideEditorCallback,
} from "@glideapps/glide-data-grid";
import { useEffect, useRef, useState } from "react";

export const numberCellEmptyValue = Symbol("number-cell-empty-value");

export interface NumberCellProps {
  readonly kind: "number-cell";
  readonly value: number | typeof numberCellEmptyValue;
  readonly options?: {
    hasFloatingPoint?: boolean;
    cursor?: "pointer" | "default";
  };
}

export type NumberCell = CustomCell<NumberCellProps>;

const floatOrDigits = /^\d+$|^[0-9]+[.,]?[0-9]+$/;

/** The key that opened the editor (if a digit was typed), as the input's first text. */
export const parseTypedNumericSeed = (
  initialValue: string | undefined,
): { draft: string; numeric: number | null } => {
  if (initialValue === undefined || initialValue === "") {
    return { draft: "", numeric: null };
  }

  const draft = initialValue.replace(",", ".");
  const numeric = Number.parseFloat(draft);

  return { draft, numeric: Number.isFinite(numeric) ? numeric : null };
};

const NumberCellEdit: ReturnType<ProvideEditorCallback<NumberCell>> = ({
  value: cell,
  onChange,
  initialValue,
  isHighlighted,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const seed = parseTypedNumericSeed(initialValue);
  const commit = (next: number | typeof numberCellEmptyValue): void => {
    onChange({ ...cell, data: { ...cell.data, value: next } });
  };
  const [draft, setDraft] = useState(() =>
    seed.draft !== ""
      ? seed.draft
      : cell.data.value === numberCellEmptyValue
        ? ""
        : String(cell.data.value),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only, the typed key is applied once when the editor opens
  useEffect(function seedTypedKeyOrSelectExisting() {
    if (seed.draft !== "") {
      commit(seed.numeric === null ? numberCellEmptyValue : seed.numeric);

      return;
    }

    if (isHighlighted) {
      inputRef.current?.select();
    }
  }, []);

  return (
    <input
      ref={inputRef}
      type="number"
      data-test-id="number-cell-input"
      onChange={(event) => {
        const next = event.target.value;

        setDraft(next);
        commit(next === "" ? numberCellEmptyValue : Number.parseFloat(next));
      }}
      value={draft}
      // biome-ignore lint/a11y/noAutofocus: Glide's overlay editor takes focus as it opens (Saleor's)
      autoFocus
    />
  );
};

export const numberCellRenderer = (locale: string): CustomRenderer<NumberCell> => ({
  kind: GridCellKind.Custom,
  isMatch: (cell): cell is NumberCell => (cell.data as { kind?: string }).kind === "number-cell",
  draw: (args, cell) => {
    const { ctx, theme, rect } = args;
    const { value } = cell.data;
    const formatted = value === numberCellEmptyValue ? "-" : value.toLocaleString(locale);

    ctx.fillStyle = theme.textDark;
    ctx.textAlign = "right";
    ctx.fillText(
      formatted,
      rect.x + rect.width - 8,
      rect.y + rect.height / 2 + getMiddleCenterBias(ctx, theme),
    );

    return true;
  },
  provideEditor: () => ({
    editor: NumberCellEdit,
    disablePadding: true,
    deletedValue: (cell) => ({
      ...cell,
      copyData: "",
      data: { ...cell.data, value: numberCellEmptyValue },
    }),
  }),
  onPaste: (value, data) => ({
    ...data,
    value: floatOrDigits.test(value) ? Number.parseFloat(value) : numberCellEmptyValue,
  }),
});
