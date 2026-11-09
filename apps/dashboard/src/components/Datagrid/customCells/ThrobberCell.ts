// Adapted from saleor-dashboard: src/components/Datagrid/customCells/ThrobberCell.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor animates its throbber shape along a path; we use Macaw's Spinner elsewhere instead of that
// throbber, so the canvas version is a plain rotating arc in the same place, size and colour.
import { type CustomRenderer, GridCellKind } from "@glideapps/glide-data-grid";

import { iconSize } from "../../icons";
import type { ThrobberCell } from "./cells";

const ROTATION_MS = 800;

export const throbberCellRenderer: CustomRenderer<ThrobberCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell): cell is ThrobberCell =>
    (cell.data as { kind?: string })?.kind === "throbber-cell",
  draw: (args) => {
    const { ctx, rect, theme, requestAnimationFrame } = args;
    const size = Math.min(iconSize.small, rect.width - 4, rect.height - 4);
    const radius = size / 2 - 1;
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const start = ((window.performance.now() % ROTATION_MS) / ROTATION_MS) * Math.PI * 2;

    ctx.save();
    ctx.strokeStyle = theme.textDark;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, start, start + Math.PI / 2);
    ctx.stroke();
    ctx.restore();
    requestAnimationFrame();

    return true;
  },
};
