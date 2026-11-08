// Adapted from saleor-dashboard: src/components/Sidebar/menu/types.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { Sprinkles } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

export interface SidebarMenuItem {
  label?: string | ReactNode;
  id: string;
  url?: string;
  matchUrls?: string[];
  /** Saleor types this as `PermissionEnum[]`; ours become typed when permissions exist (M1.2). */
  permissions?: string[];
  type: "item" | "itemGroup" | "divider";
  icon?: ReactNode;
  onClick?: () => void;
  children?: SidebarMenuItem[];
  paddingY?: Sprinkles["paddingY"];
  endAdornment?: ReactNode;
  separatorBefore?: boolean;
  labelStyle?: "default" | "settings";
  /** Expand this group on mount even when nothing inside it is active. */
  defaultExpanded?: boolean;
}
