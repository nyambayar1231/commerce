// Adapted from saleor-dashboard: src/structures/components/MenuItemsSortableTree/MenuItemsSortableTree.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The menu's item tree with Saleor's drag handles and edit/remove buttons. `maxDepth` is our
// addition (the API nests items three levels deep, so a fourth is refused rather than dropped).
import { Box, Text } from "@saleor/macaw-ui";
import { FormattedMessage } from "react-intl";

import { SortableTree } from "../../../components/SortableTree/SortableTree";
import type { MenuItemFragment } from "../../../graphql/types.generated";
import type { RecursiveMenuItem } from "../../types";
import { MenuItemsSortableTreeItem } from "./MenuItemsSortableTreeItem";
import { getNodeData, getRecursiveItems } from "./utils";

const MAX_ITEM_DEPTH = 2;

interface MenuItemsSortableTreeProps {
  items: RecursiveMenuItem[];
  onChange: (newTree: RecursiveMenuItem[]) => void;
  onItemEdit: (id: string) => void;
  onItemRemove: (id: string) => void;
}

export const MenuItemsSortableTree = ({
  items,
  onChange,
  onItemEdit,
  onItemRemove,
}: MenuItemsSortableTreeProps) => {
  if (!items.length) {
    return (
      <Box
        backgroundColor="default1"
        paddingBottom={3}
        borderColor="default1"
        borderBottomWidth={1}
        borderBottomStyle="solid"
      >
        <Text>
          <FormattedMessage
            id="YEIFiI"
            defaultMessage="Add new structure item to begin creating structure"
          />
        </Text>
      </Box>
    );
  }

  return (
    <SortableTree<MenuItemFragment>
      maxDepth={MAX_ITEM_DEPTH}
      items={items.map(getNodeData)}
      onChange={(newTree) => onChange(getRecursiveItems(newTree))}
      renderTreeItem={(props) => (
        <MenuItemsSortableTreeItem
          {...props}
          onEdit={(id) => onItemEdit(String(id))}
          onRemove={(id) => onItemRemove(String(id))}
        />
      )}
    />
  );
};
