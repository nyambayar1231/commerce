// Adapted from saleor-dashboard: src/components/Datagrid/customCells/DateCell.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's date cell: the longest date format that fits next to the time, the time in the light
// text color. The value is the API's ISO date-time string.
import {
  type CustomCell,
  type CustomRenderer,
  GridCellKind,
  getMiddleCenterBias,
  type Rectangle,
  type Theme,
} from "@glideapps/glide-data-grid";

interface DateCellProps {
  readonly kind: "date-cell";
  readonly value: string;
}

export type DateCell = CustomCell<DateCellProps>;

type DateFormaters = {
  full: Intl.DateTimeFormat;
  long: Intl.DateTimeFormat;
  short: Intl.DateTimeFormat;
};

export const dateCellRenderer = (locale: string): CustomRenderer<DateCell> => {
  const dateFormaters: DateFormaters = {
    full: new Intl.DateTimeFormat(locale, { dateStyle: "full" }),
    long: new Intl.DateTimeFormat(locale, { dateStyle: "long" }),
    short: new Intl.DateTimeFormat(locale, { dateStyle: "short" }),
  };
  const timeFormater = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

  return {
    kind: GridCellKind.Custom,
    isMatch: (cell): cell is DateCell => (cell.data as { kind?: string })?.kind === "date-cell",
    draw: (args, cell) => {
      const { ctx, theme, rect } = args;
      const date = new Date(cell.data.value);

      if (Number.isNaN(date.getTime())) {
        // invalid date object
        return true;
      }

      const cellWidth = rect.width - theme.cellHorizontalPadding * 2;
      const textY = rect.y + rect.height / 2 + getMiddleCenterBias(ctx, theme);
      const textXStart = rect.x + theme.cellHorizontalPadding;
      const displayTime = timeFormater.format(date);
      const { displayDate, justifyToRight } = formatDate({
        date,
        formaters: dateFormaters,
        time: displayTime,
        ctx,
        cellWidth,
      });

      drawText(ctx, displayDate, textXStart, textY, "left", theme.textDark);

      const dateTextXEnd = textXStart + ctx.measureText(displayDate).width;

      drawText(
        ctx,
        displayTime,
        calculateTimeX({ rect, theme, justifyToRight, dateTextXEnd }),
        textY,
        justifyToRight ? "right" : "left",
        theme.textLight,
      );

      return true;
    },
  };
};

function formatDate({
  cellWidth,
  ctx,
  date,
  formaters,
  time,
}: {
  date: Date;
  formaters: DateFormaters;
  time: string;
  ctx: CanvasRenderingContext2D;
  cellWidth: number;
}): { displayDate: string; justifyToRight: boolean } {
  const full = formaters.full.format(date);
  const long = formaters.long.format(date);
  const short = formaters.short.format(date);

  if (cellWidth >= getTextWidth(ctx, full, time)) {
    return { displayDate: full, justifyToRight: true };
  }

  const displayFormat = [long, short].find(
    (format) => getTextWidth(ctx, format, time) <= cellWidth,
  );

  return displayFormat
    ? { displayDate: displayFormat, justifyToRight: true }
    : { displayDate: short, justifyToRight: false };
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function getTextWidth(ctx: CanvasRenderingContext2D, date: string, time: string) {
  return ctx.measureText(`${date} ${time}`).width;
}

function calculateTimeX({
  rect,
  justifyToRight,
  theme,
  dateTextXEnd,
}: {
  rect: Rectangle;
  theme: Theme;
  justifyToRight: boolean;
  dateTextXEnd: number;
}) {
  return justifyToRight ? rect.x + rect.width - theme.cellHorizontalPadding : dateTextXEnd + 5;
}
