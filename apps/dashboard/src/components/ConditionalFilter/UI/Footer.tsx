// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/Footer.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The panel footer: "Add condition" on the left; "Clear filters", "Close", "Apply" on the right.
// Saleor's popover/inline footer layout is dropped.
import { Box, Button, type ButtonProps, type PropsWithBox } from "@saleor/macaw-ui";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { iconSize, iconStrokeWidth } from "../../icons";
import { useFilterContext } from "./context";
import styles from "./Footer.module.css";

export const Footer = ({ children, ...props }: PropsWithBox<{ children?: ReactNode }>) => (
  <Box className={styles.panelFooter} {...props}>
    {children}
  </Box>
);

export const AddRowButton = ({ children, ...props }: ButtonProps) => {
  const { emitter } = useFilterContext();

  return (
    <Button
      onClick={() => emitter.addRow()}
      variant="secondary"
      icon={<Plus size={iconSize.small} strokeWidth={iconStrokeWidth} />}
      {...props}
    >
      {children}
    </Button>
  );
};

export const ClearButton = ({ children, disabled, ...props }: ButtonProps) => {
  const { actionButtonsDisabled } = useFilterContext();

  return (
    <Button variant="secondary" disabled={disabled ?? actionButtonsDisabled} {...props}>
      {children}
    </Button>
  );
};

export const CloseButton = ({ children, ...props }: ButtonProps): React.ReactNode => (
  <Button variant="tertiary" {...props}>
    {children}
  </Button>
);

export const ConfirmButton = ({ children, ...props }: ButtonProps) => {
  const { actionButtonsDisabled } = useFilterContext();

  return (
    <Button variant="primary" disabled={actionButtonsDisabled} {...props}>
      {children}
    </Button>
  );
};
