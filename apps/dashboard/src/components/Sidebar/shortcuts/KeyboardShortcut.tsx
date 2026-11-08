// Adapted from saleor-dashboard: src/components/Sidebar/shortcuts/ShortcutItem.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the key-cap component; Saleor's shortcut rows (search, playground) are omitted.
import { Box } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

export const KeyboardShortcut = ({ children }: { children: ReactNode }) => {
  return (
    <Box
      borderColor="default1"
      borderStyle="solid"
      borderWidth={1}
      paddingX={0.5}
      borderRadius={2}
      boxShadow="defaultFocused"
    >
      {children}
    </Box>
  );
};
