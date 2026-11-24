// Adapted from saleor-dashboard: src/structures/components/MenuItemDialog/types.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Our dialog keeps Saleor's four link kinds but shows them in one searchable select: a category, a
// collection, a page, or a typed URL.
export type MenuItemType = "category" | "collection" | "page" | "url";

export interface MenuItemLink {
  type: MenuItemType;
  /** A global id for the three object kinds, the URL itself for `url`. */
  value: string;
  /** What the row and the select show (the object's name or the typed URL). */
  display: string;
}

export interface MenuItemDialogFormData {
  id?: string;
  name: string;
  link: MenuItemLink | null;
}
