// Adapted from saleor-dashboard: src/components/BulkDeleteButton/BulkDeleteButton.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Button } from "@saleor/macaw-ui";
import { Trash2 } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

import { iconSize, iconStrokeWidthBySize } from "../icons";

interface BulkDeleteButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  count: number;
  size?: "small" | "medium";
}

export const BulkDeleteButton = forwardRef<HTMLButtonElement, BulkDeleteButtonProps>(
  ({ onClick, children, disabled, count, size = "medium" }, ref) => (
    <Button
      ref={ref}
      disabled={disabled}
      onClick={onClick}
      type="button"
      size={size}
      variant="secondary"
      data-test-id="bulk-delete-button"
    >
      <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
      <FormattedMessage
        id="9wjl6Q"
        defaultMessage="{action} ({count})"
        description="bulk action button label with selected count"
        values={{ action: children, count }}
      />
    </Button>
  ),
);

BulkDeleteButton.displayName = "BulkDeleteButton";
