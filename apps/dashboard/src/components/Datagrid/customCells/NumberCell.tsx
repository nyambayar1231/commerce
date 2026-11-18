// Adapted from saleor-dashboard: src/components/Datagrid/customCells/NumberCell.tsx and
// useDatagridNumericEdit.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's editable number cell: drawn right-aligned in the UI locale; double-click, Enter or a
// typed digit opens a number input over the cell (a typed digit replaces the value, Enter/F2
// selects it, empty stays empty rather than 0), and pasting a number fills it. A typed digit is
// applied whenever Glide seeds the overlay, not only when it opens: a key that lands on the canvas
// re-opens the same mounted overlay with it (M14.3 fix round), and both the input's text and its
// focus are set in a layout effect, synchronously with that re-open, so the digits typed after it
// continue the number instead of landing on the stale selected value (M14.3 fix round 2).
// Saleor's "percent" format comes with its first user.
import {
  type CustomCell,
  type CustomRenderer,
  GridCellKind,
  getMiddleCenterBias,
  type ProvideEditorCallback,
} from "@glideapps/glide-data-grid";
import { useLayoutEffect, useRef, useState } from "react";

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
  const hasMounted = useRef(false);
  const appliedSeed = useRef<string | undefined>(undefined);

  // Glide mounts the editor once per overlay. When a typed key lands on the canvas instead of the
  // input, Glide re-opens the *same* mounted overlay with that key as `initialValue` (its
  // `reselect` replaces the overlay's props, not the component), so a mount-only seed is dropped:
  // `onChange` never runs, `tempValue` stays unset and Enter closes the overlay without an edit —
  // the cell keeps its old value and nothing is tinted (found in the M14.3 fix round, from the
  // stock cells). Apply every new seed. This must be a *layout* effect: Glide calls `reselect` from
  // its keydown handler, so the render and this commit run synchronously inside that event, before
  // the browser dispatches the next key. A passive effect runs a task later, after the next
  // keystroke has already gone to the input, which still selects the old value: with "1000"
  // selected, `2500` then committed as `500` (M14.3 fix round 2, seen in Chrome). The refs make
  // this run once per seed, not once per render.
  useLayoutEffect(function applyTypedKeyAndTakeFocus() {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    const isFirstRun = !hasMounted.current;

    hasMounted.current = true;

    if (seed.draft !== "" && (isFirstRun || appliedSeed.current !== initialValue)) {
      appliedSeed.current = initialValue;
      // `autoFocus` alone loses to Glide: the canvas keeps focus and typed keys never reach the
      // input (found in M14.3), so take focus explicitly.
      input.focus();
      setDraft(seed.draft);

      commit(seed.numeric === null ? numberCellEmptyValue : seed.numeric);

      return;
    }

    if (isFirstRun) {
      input.focus();

      if (isHighlighted) {
        input.select();
      }
    }
  });

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
