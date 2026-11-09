// Adapted from saleor-dashboard: src/components/FormSpacer.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor styles it with the legacy macaw-ui `makeStyles` (marginTop: theme.spacing(3) = 24px).
import { Box } from "@saleor/macaw-ui";
import type * as React from "react";

interface FormSpacerProps {
  children?: React.ReactNode;
}

export const FormSpacer = ({ children }: FormSpacerProps) => (
  <Box __marginTop="24px">{children}</Box>
);

FormSpacer.displayName = "FormSpacer";

export default FormSpacer;
