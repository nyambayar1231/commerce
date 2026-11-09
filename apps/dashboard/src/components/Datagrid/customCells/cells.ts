// Adapted from saleor-dashboard: src/components/Datagrid/customCells/cells.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the cells our lists use so far.
import { GridCellKind, type TextCell, type Theme } from "@glideapps/glide-data-grid";

export function readonlyTextCell(
  value: string,
  hasCursorPointer = true,
  style: TextCell["style"] = "normal",
  themeOverride?: Partial<Theme>,
): TextCell {
  return {
    cursor: hasCursorPointer ? "pointer" : "default",
    allowOverlay: false,
    readonly: true,
    data: value,
    displayData: value,
    kind: GridCellKind.Text,
    style,
    themeOverride,
  };
}
