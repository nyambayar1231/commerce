// Adapted from saleor-dashboard: src/components/Datagrid/customCells/cells.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the cells our lists use so far.
import {
  type CustomCell,
  type GridCell,
  GridCellKind,
  type TextCell,
  type Theme,
} from "@glideapps/glide-data-grid";

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

/** A tree's "load more" row label; faded while that page is loading. */
export function loadMoreTextCell(
  value: string,
  themeOverride?: Partial<Theme>,
  options?: { loading?: boolean },
): TextCell {
  return {
    cursor: options?.loading ? "default" : "pointer",
    allowOverlay: false,
    readonly: true,
    data: value,
    displayData: value,
    kind: GridCellKind.Text,
    style: options?.loading ? "faded" : "normal",
    themeOverride,
  };
}

interface ThrobberCellData {
  kind: "throbber-cell";
}

export type ThrobberCell = CustomCell<ThrobberCellData>;

interface ChevronCellData {
  kind: "chevron-cell";
  direction: "down" | "right";
}

export type ChevronCell = CustomCell<ChevronCellData>;

export function chevronCell(expanded: boolean, hasCursorPointer = true): ChevronCell {
  return {
    cursor: hasCursorPointer ? "pointer" : "default",
    allowOverlay: false,
    readonly: true,
    kind: GridCellKind.Custom,
    copyData: "",
    data: {
      kind: "chevron-cell",
      direction: expanded ? "down" : "right",
    },
  };
}

export function loadingCell(): ThrobberCell {
  return {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    readonly: true,
    copyData: "",
    data: {
      kind: "throbber-cell",
    },
  };
}

interface ThumbnailCellData {
  kind: "thumbnail-cell";
  /** The thumbnail URL; "" draws Saleor's empty-image placeholder. */
  image: string;
  name: string;
}

export type ThumbnailCell = CustomCell<ThumbnailCellData>;

/** Saleor's thumbnailCell: a small image next to the name, e.g. the product list's name column. */
export function thumbnailCell(
  name: string,
  image: string,
  opts?: Partial<GridCell>,
): ThumbnailCell {
  return {
    allowOverlay: false,
    readonly: true,
    ...opts,
    kind: GridCellKind.Custom,
    copyData: name ?? "",
    data: {
      kind: "thumbnail-cell",
      image,
      name,
    },
  };
}
