// The custom cell renderers our grids use (Saleor: useCustomCellRenderers, which also has money,
// number, dropdown and other cells that come with their lists).
import type { CustomRenderer } from "@glideapps/glide-data-grid";

import { chevronCellRenderer } from "./ChevronCell";
import { throbberCellRenderer } from "./ThrobberCell";
import { thumbnailCellRenderer } from "./ThumbnailCell";

export const customRenderers = [
  chevronCellRenderer,
  throbberCellRenderer,
  thumbnailCellRenderer,
] as unknown as readonly CustomRenderer[];
