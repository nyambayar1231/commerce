// Adapted from saleor-dashboard: src/structures/components/MenuItemsSortableTree/MenuItemsSortableTreeItem.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// One row: a drag handle, the item's name, and Saleor's edit and remove buttons (its "Show" button,
// translations and the child-count badge are not here).
import type { UniqueIdentifier } from "@dnd-kit/core";
import { Box, Button, Text } from "@saleor/macaw-ui";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useIntl } from "react-intl";

import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import type { TreeItemComponentProps } from "../../../components/SortableTree/types";
import type { MenuItemFragment } from "../../../graphql/types.generated";
import { buttonMessages } from "../../../intl";

interface MenuItemsSortableTreeItemProps extends TreeItemComponentProps<MenuItemFragment> {
  onEdit: (id: UniqueIdentifier) => void;
  onRemove: (id: UniqueIdentifier) => void;
}

export const MenuItemsSortableTreeItem = ({
  innerRef,
  id,
  data,
  clone,
  depth,
  disableInteraction,
  ghost,
  handleProps,
  indentationWidth,
  style,
  wrapperRef,
  onEdit,
  onRemove,
}: MenuItemsSortableTreeItemProps) => {
  const intl = useIntl();

  return (
    <Box
      ref={wrapperRef}
      __marginLeft={`${indentationWidth * depth}px`}
      __marginBottom="-1px"
      {...(clone && { __pointerEvents: "none" })}
      __opacity={ghost ? 0.6 : 1}
    >
      <Box
        data-test-id="menu-item"
        position="relative"
        borderColor="default1"
        borderStyle="solid"
        borderWidth={1}
        backgroundColor="default1"
        padding={3}
        paddingLeft={5}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        boxShadow={clone ? "defaultOverlay" : "none"}
        ref={innerRef}
        style={style}
        pointerEvents={disableInteraction ? "none" : undefined}
      >
        <Box display="flex" gap={6} alignItems="center">
          <button
            type="button"
            {...handleProps}
            style={{
              background: "none",
              border: 0,
              padding: 4,
              display: "flex",
              alignItems: "center",
              cursor: "grab",
            }}
          >
            <GripVertical size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
          </button>
          <Text>{data.name}</Text>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            data-test-id="edit-menu-item-button"
            variant="secondary"
            onClick={() => onEdit(id)}
            aria-label={intl.formatMessage(buttonMessages.edit)}
            icon={<Pencil size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />}
          />
          <Button
            data-test-id="remove-menu-item-button"
            variant="secondary"
            onClick={() => onRemove(id)}
            aria-label={intl.formatMessage(buttonMessages.delete)}
            icon={<Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />}
          />
        </Box>
      </Box>
    </Box>
  );
};
