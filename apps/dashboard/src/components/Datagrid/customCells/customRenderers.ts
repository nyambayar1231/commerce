// The custom cell renderers our grids use (Saleor: useCustomCellRenderers, which also has money,
// number, dropdown, thumbnail and other cells that come with their lists).
import type { CustomRenderer } from "@glideapps/glide-data-grid";

import { chevronCellRenderer } from "./ChevronCell";
import { throbberCellRenderer } from "./ThrobberCell";

export const customRenderers = [
  chevronCellRenderer,
  throbberCellRenderer,
] as unknown as readonly CustomRenderer[];
