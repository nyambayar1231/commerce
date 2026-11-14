// Adapted from saleor-dashboard: src/components/Datagrid/components/RowActions.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A row's actions in the grid's sticky right-hand bar: one action with an icon is a plain icon
// button, more open Saleor's "⋮" menu. Saleor's CardMenu (legacy macaw-ui) is our TopNav menu with
// a ghost "⋮" trigger.
import { Button } from "@saleor/macaw-ui";
import { EllipsisVertical } from "lucide-react";

import type { TopNavMenuItem } from "../../AppLayout/TopNav/Menu";
import { Menu } from "../../AppLayout/TopNav/Menu";
import { iconSize, iconStrokeWidthBySize } from "../../icons";
import styles from "../Datagrid.module.css";

export type RowActionItem = TopNavMenuItem;

interface RowActionsProps {
  menuItems: RowActionItem[];
  disabled?: boolean;
}

export const RowActions = ({ menuItems, disabled }: RowActionsProps) => {
  const [firstMenuItem] = menuItems;

  if (!firstMenuItem) {
    return null;
  }

  return (
    <div className={styles.rowAction}>
      {menuItems.length === 1 && firstMenuItem.icon ? (
        <Button
          type="button"
          variant="tertiary"
          className={styles.ghostIcon}
          data-test-id="row-action-button"
          disabled={disabled || firstMenuItem.disabled}
          title={firstMenuItem.label}
          aria-label={firstMenuItem.label}
          icon={firstMenuItem.icon}
          onClick={() => firstMenuItem.onSelect({})}
        />
      ) : (
        <Menu
          items={menuItems}
          dataTestId="row-actions-menu"
          trigger={
            <Button
              type="button"
              variant="tertiary"
              className={styles.ghostIcon}
              data-test-id="row-action-button"
              disabled={disabled}
              icon={
                <EllipsisVertical size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
              }
            />
          }
        />
      )}
    </div>
  );
};
