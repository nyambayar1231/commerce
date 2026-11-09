// Adapted from saleor-dashboard: src/components/BackButton.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Button, type ButtonProps } from "@saleor/macaw-ui";
import type { ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { buttonMessages } from "../intl";

interface BackButtonProps extends ButtonProps {
  children?: ReactNode;
}

const BackButton = ({ children, ...props }: BackButtonProps) => (
  <Button data-test-id="back" variant="secondary" {...props} type="button">
    {children ?? <FormattedMessage {...buttonMessages.back} />}
  </Button>
);

BackButton.displayName = "BackButton";
export default BackButton;
