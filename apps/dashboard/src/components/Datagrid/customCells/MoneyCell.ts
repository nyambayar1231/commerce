// Adapted from saleor-dashboard: src/components/Datagrid/customCells/Money/MoneyCell.tsx and
// Money/utils.ts drawCurrency (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's read-only money cell: the amount right-aligned, a three-letter currency code drawn
// smaller on the cell's left, or the currency symbol when the code doesn't fit. Saleor's editor,
// price ranges and breakdown marker are left out (no editable or ranged money grid yet). Amounts
// have no minor digits, as the rest of the dashboard's prices (MNT, ADR-0013).
import {
  type CustomCell,
  type CustomRenderer,
  GridCellKind,
  getMiddleCenterBias,
  type Rectangle,
  type Theme,
} from "@glideapps/glide-data-grid";

interface MoneyCellProps {
  readonly kind: "money-cell";
  readonly currency: string;
  readonly value: number | null;
}

export type MoneyCell = CustomCell<MoneyCellProps>;

/** Currency labels are drawn smaller so they read as secondary. */
const SECONDARY_FONT_SCALE = 0.85;

const getSecondaryFont = (theme: Theme): string =>
  [
    theme.baseFontStyle.replace(
      /(\d+(?:\.\d+)?)px/,
      (_, size: string) => `${Number(size) * SECONDARY_FONT_SCALE}px`,
    ),
    theme.fontFamily,
  ].join(" ");

function drawCurrency(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  rect: Rectangle,
  currency: string,
) {
  const font = getSecondaryFont(theme);

  ctx.fillStyle = theme.textLight;
  ctx.textAlign = "left";
  ctx.font = font;
  ctx.fillText(
    currency,
    rect.x + theme.cellHorizontalPadding,
    rect.y + rect.height / 2 + getMiddleCenterBias(ctx, font),
  );
}

export const moneyCellRenderer = (locale: string): CustomRenderer<MoneyCell> => ({
  kind: GridCellKind.Custom,
  isMatch: (cell): cell is MoneyCell => (cell.data as { kind?: string })?.kind === "money-cell",
  draw: (args, cell) => {
    const { ctx, theme, rect } = args;
    const { currency, value } = cell.data;

    if (value === null || !currency) {
      return true;
    }

    const formatOptions = {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    } as const;
    const format = new Intl.NumberFormat(locale, {
      ...formatOptions,
      currencyDisplay: "code",
    }).formatToParts(value);
    const shortFormat = new Intl.NumberFormat(locale, {
      ...formatOptions,
      currencyDisplay: "symbol",
    }).formatToParts(value);

    ctx.font = `550 ${theme.baseFontStyle} ${theme.fontFamily}`;

    const width = ctx.measureText(format.map((part) => part.value).join("")).width;
    const isHugging = width > rect.width - theme.cellHorizontalPadding * 2;

    let drawingPosition = rect.x + rect.width - theme.cellHorizontalPadding;
    const y = rect.y + rect.height / 2 + getMiddleCenterBias(ctx, theme);
    const displayFormat = isHugging ? shortFormat : format;

    for (const part of [...displayFormat].reverse()) {
      ctx.textAlign = "right";
      ctx.fillStyle =
        part.type === "currency" && part.value.length > 2 ? theme.textLight : theme.textDark;

      if (part.type === "currency" && part.value.length > 2 && !isHugging) {
        ctx.save();
        drawCurrency(ctx, theme, rect, part.value);
        ctx.restore();
      } else {
        ctx.fillText(part.value, drawingPosition, y);
        drawingPosition -= ctx.measureText(part.value).width;
      }
    }

    return true;
  },
});
