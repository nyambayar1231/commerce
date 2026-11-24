// Adapted from saleor-dashboard: src/structures/views/MenuDetails/utils.ts (BSD-3-Clause, Copyright
// (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The menu screen's item helpers: finding an item in the tree, the edit dialog's initial data, and
// the pending tree operations as `menuItemMove` inputs. Saleor's remove-id helper is not needed:
// deleting an item persists immediately.
import type { MenuItemMoveInput } from "../graphql/types.generated";
import { getItemLink } from "./components/MenuItemDialog/options";
import type { MenuItemDialogFormData } from "./components/MenuItemDialog/types";
import type { TreeOperation } from "./components/MenuItems/tree";
import type { RecursiveMenuItem } from "./types";

export const findMenuItem = (
  items: RecursiveMenuItem[],
  id: string | undefined,
): RecursiveMenuItem | undefined => {
  if (!id) {
    return undefined;
  }

  for (const item of items) {
    if (item.id === id) {
      return item;
    }

    const found = findMenuItem(item.children ?? [], id);

    if (found) {
      return found;
    }
  }

  return undefined;
};

export const getMenuItemDialogInitial = (
  item: RecursiveMenuItem | undefined,
): MenuItemDialogFormData | null =>
  item ? { id: item.id, name: item.name, link: getItemLink(item) } : null;

export const getMoves = (operations: TreeOperation[]): MenuItemMoveInput[] =>
  operations.map((operation) => ({
    itemId: operation.id,
    parentId: operation.parentId,
    sortOrder: operation.sortOrder,
  }));
