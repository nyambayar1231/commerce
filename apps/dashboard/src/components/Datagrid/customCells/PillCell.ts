// Adapted from saleor-dashboard: src/components/Datagrid/customCells/PillCell.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's pill cell (the order list's payment and status columns) and its OKLCH pill colors.
// Saleor falls back to chroma-js for browsers without OKLCH; every browser we support has it, so
// the colors are always OKLCH strings and no color library is added.
import {
  type CustomCell,
  type CustomRenderer,
  GridCellKind,
  getMiddleCenterBias,
} from "@glideapps/glide-data-grid";

export interface PillColor {
  readonly base: string;
  readonly border: string;
  readonly text: string;
}

const oklch = (l: number, c: number, h: number, a?: number): string =>
  `oklch(${l}% ${c} ${h}${a ? ` / ${a}` : ""})`;

export const hueToPillColorLight = (hue: number): PillColor => {
  const isNeutral = hue === 0;
  const l = isNeutral ? 97 : 94;
  const c = isNeutral ? 0 : 0.065;
  const cText = isNeutral ? 0 : 0.06;
  const base = oklch(l, c, hue, isNeutral ? 0.3 : undefined); // Add transparency to neutral
  const border = oklch(l - (isNeutral ? 45 : 8), c, hue, isNeutral ? 0.3 : undefined);
  const text = oklch(l - 55, cText, hue);

  return { base, border, text };
};

export const hueToPillColorDark = (hue: number): PillColor => {
  const isNeutral = hue === 0;
  const l = isNeutral ? 25 : 40;
  const s = isNeutral ? 0 : 0.07;
  const sText = isNeutral ? 0 : 0.08;
  const contrast = isNeutral ? 70 : 55;
  const base = oklch(l, s, hue, isNeutral ? 0.3 : undefined); // Add transparency to neutral
  const border = oklch(l + (isNeutral ? 55 : 3), s, hue, isNeutral ? 0.3 : undefined);
  const text = oklch(l + contrast, sText, hue);

  return { base, border, text };
};

interface PillCellProps {
  readonly kind: "auto-tags-cell";
  readonly value: string;
  readonly color: PillColor;
}

export type PillCell = CustomCell<PillCellProps>;

export const pillCellRenderer: CustomRenderer<PillCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell): cell is PillCell => (cell.data as { kind?: string })?.kind === "auto-tags-cell",
  draw: (args, cell) => {
    const label = cell.data.value;
    const { rect, ctx, theme } = args;
    const { x, y, height } = rect;
    const { base, border, text } = cell.data.color;

    ctx.font = `500 12px ${theme.fontFamily}`;

    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = textMetrics.fontBoundingBoxAscent + textMetrics.fontBoundingBoxDescent;
    const padding = 8;
    const tileWidth = textWidth + 2 * padding;
    const tileHeight = textHeight * 1.35;

    // Draw the tile
    if ("roundRect" in ctx) {
      ctx.fillStyle = base;
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.roundRect(x + 10, y + height / 2 - tileHeight / 2, tileWidth, tileHeight, 16);
      ctx.fill();
      ctx.stroke();
    }

    // Draw the text
    ctx.fillStyle = text;
    ctx.fillText(label, x + 10 + padding, y + height / 2 + getMiddleCenterBias(ctx, theme));

    return true;
  },
};
