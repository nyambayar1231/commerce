// Copied from saleor-dashboard: src/components/Savebar/SavebarReadOnlyLabel.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The Savebar slot on detail pages the user can read but not edit: a muted "Read-only" label.
import { Box, Text } from "@saleor/macaw-ui";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { FormattedMessage } from "react-intl";

interface ReadOnlyLabelProps {
  /** Overrides the default "Read-only" copy. */
  children?: ReactNode;
}

export const ReadOnlyLabel = ({ children }: ReadOnlyLabelProps) => (
  <Box display="flex" alignItems="center" gap={2} data-test-id="savebar-read-only">
    <Box display="flex" alignItems="center" color="default2" aria-hidden="true">
      <Lock size={14} />
    </Box>
    <Text size={3} color="default2">
      {children ?? (
        <FormattedMessage
          defaultMessage="Read-only"
          description="savebar label shown on detail pages where the current user lacks permission to edit"
          id="qjT9IB"
        />
      )}
    </Text>
  </Box>
);
