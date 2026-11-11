// Adapted from saleor-dashboard: src/components/Datagrid/customCells/ThumbnailCell.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// One grid cell with a rounded thumbnail and a label: the product list's name column. Saleor's
// interactive bits (the inline rename editor and paste handling) are not ported because our lists
// are read-only, and its empty-image icon comes from EmptyImage, which we don't have yet, so the
// same Lucide `Image` shape is built here as a data URI.
import { type CustomRenderer, GridCellKind, getMiddleCenterBias } from "@glideapps/glide-data-grid";

import { iconSize, iconStrokeWidthBySize } from "../../icons";
import type { ThumbnailCell } from "./cells";

const EMPTY_IMAGE_ICON_SIZE = iconSize.small;

/** Lucide `Image` (lucide-react 0.555.0) as SVG markup, drawn by the cell's canvas. */
const emptyImageIconSvg = (color: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${EMPTY_IMAGE_ICON_SIZE}" height="${EMPTY_IMAGE_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${iconStrokeWidthBySize.small}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;

const getEmptyImageIconDataUri = (color: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(emptyImageIconSvg(color))}`;

export const thumbnailCellRenderer: CustomRenderer<ThumbnailCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell): cell is ThumbnailCell =>
    (cell.data as { kind?: string })?.kind === "thumbnail-cell",
  draw: (args, cell) => {
    const { ctx, rect, theme, imageLoader, col, row } = args;
    const { image, name } = cell.data;
    const xPad = 5;
    const size = rect.height - xPad * 2;
    const drawX = rect.x + xPad;
    const drawY = rect.y + xPad;
    const imageResult = image ? imageLoader.loadOrGetImage(image, col, row) : undefined;

    ctx.save();

    if (imageResult !== undefined && image) {
      roundedImage(ctx, drawX, drawY, size, size, 4);
      ctx.strokeStyle = theme.borderColor;
      ctx.stroke();
      ctx.clip();
      ctx.drawImage(imageResult, drawX, drawY, size, size);
    } else if (!image) {
      roundedImage(ctx, drawX, drawY, size, size, 4);
      ctx.strokeStyle = theme.borderColor;
      ctx.stroke();

      const icon = imageLoader.loadOrGetImage(getEmptyImageIconDataUri(theme.textLight), col, row);

      if (icon) {
        const iconX = drawX + (size - EMPTY_IMAGE_ICON_SIZE) / 2;
        const iconY = drawY + (size - EMPTY_IMAGE_ICON_SIZE) / 2;

        ctx.drawImage(icon, iconX, iconY, EMPTY_IMAGE_ICON_SIZE, EMPTY_IMAGE_ICON_SIZE);
      }
    }

    ctx.restore();

    if (name !== undefined) {
      ctx.fillStyle = theme.textDark;
      ctx.fillText(
        name,
        drawX + size + 10,
        rect.y + rect.height / 2 + getMiddleCenterBias(ctx, theme),
      );
    }

    return true;
  },
};

function roundedImage(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
