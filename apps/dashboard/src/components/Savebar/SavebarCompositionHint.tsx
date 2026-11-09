// Copied from saleor-dashboard: src/components/Savebar/SavebarCompositionHint.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, Text } from "@saleor/macaw-ui";
import type { ReactNode } from "react";
import { defineMessage, useIntl } from "react-intl";

const messages = {
  includes: defineMessage<{ segments: string }>({
    id: "PesQ3H",
    defaultMessage: "Unsaved changes: {segments}",
    description: "Savebar hint listing which dirty areas will persist on Save",
  }),
};

interface SavebarCompositionHintProps {
  /** Localized segment labels (e.g. "general", "channel availability"). */
  segments: string[];
  "data-test-id"?: string;
}

/**
 * Presentational Savebar hint. Entity pages build `segments` from their own
 * save-composition flags, then render this shared chrome.
 *
 * Hidden on mobile so Cancel/Save stay usable in the fixed-height savebar.
 */
export const SavebarCompositionHint = ({
  segments,
  "data-test-id": dataTestId,
}: SavebarCompositionHintProps): ReactNode => {
  const intl = useIntl();

  if (segments.length === 0) {
    return null;
  }

  return (
    <Box
      display={{ mobile: "none", tablet: "block", desktop: "block" }}
      __minWidth="0"
      __maxWidth="40%"
      overflow="hidden"
    >
      <Text size={2} color="default2" ellipsis data-test-id={dataTestId}>
        {intl.formatMessage(messages.includes, {
          segments: segments.join(", "),
        })}
      </Text>
    </Box>
  );
};
