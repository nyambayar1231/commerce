// Adapted from saleor-dashboard: src/structures/components/MenuItems/MenuItems.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The "Structure Items" card: the sortable tree, Undo while there are pending moves, and "Create
// new item". Saleor diffs the dragged tree against the rendered one; here the screen owns the
// pending moves, so this card reports the new tree and the screen computes the moves.
import { Box, Button } from "@saleor/macaw-ui";
import { useIntl } from "react-intl";

import { DashboardCard } from "../../../components/Card";
import type { RecursiveMenuItem } from "../../types";
import { MenuItemsSortableTree } from "../MenuItemsSortableTree/MenuItemsSortableTree";
import { messages } from "./messages";

interface MenuItemsProps {
  canUndo: boolean;
  items: RecursiveMenuItem[];
  onChange: (newTree: RecursiveMenuItem[]) => void;
  onItemAdd: () => void;
  onItemEdit: (id: string) => void;
  onItemRemove: (id: string) => void;
  onUndo: () => void;
}

export const MenuItems = ({
  canUndo,
  items,
  onChange,
  onItemAdd,
  onItemEdit,
  onItemRemove,
  onUndo,
}: MenuItemsProps) => {
  const intl = useIntl();

  return (
    <DashboardCard>
      <DashboardCard.Header>
        <DashboardCard.Title>{intl.formatMessage(messages.itemsSectionHeader)}</DashboardCard.Title>
        <DashboardCard.Toolbar>
          <Button
            variant="secondary"
            disabled={!canUndo}
            onClick={onUndo}
            data-test-id="undo-button"
          >
            {intl.formatMessage(messages.undo)}
          </Button>
        </DashboardCard.Toolbar>
      </DashboardCard.Header>
      <DashboardCard.Content>
        <Box data-test-id="menu-items-list" backgroundColor="default1" marginBottom={4}>
          <MenuItemsSortableTree
            items={items}
            onChange={onChange}
            onItemEdit={onItemEdit}
            onItemRemove={onItemRemove}
          />
        </Box>
        <Button onClick={onItemAdd} variant="secondary" data-test-id="create-new-menu-item">
          {intl.formatMessage(messages.createNewItem)}
        </Button>
      </DashboardCard.Content>
    </DashboardCard>
  );
};
