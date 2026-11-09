// Adapted from saleor-dashboard: src/components/Datagrid/types.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { Theme } from "@glideapps/glide-data-grid";

export interface AvailableColumn {
  id: string;
  title: string;
  width: number;
  group?: string;
  metaGroup?: string; // Description for column picker
  pickerTitle?: string;
  hasMenu?: boolean;
  icon?: string;
  themeOverride?: Partial<Theme>;
  action?: (id: string) => boolean;
  headerAlign?: "left" | "right";
  /** When true, column header cannot be dragged to reorder. */
  disableReorder?: boolean;
  /** Extra unused grid width is given to this column (glide-data-grid `grow`). */
  grow?: number;
}
