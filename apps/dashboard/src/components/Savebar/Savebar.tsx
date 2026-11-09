// Adapted from saleor-dashboard: src/components/Savebar/Savebar.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// React's createPortal instead of @radix-ui/react-portal (not a direct dependency here); same target.
import { Box } from "@saleor/macaw-ui";
import type * as React from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { savebarHeight } from "../AppLayout/consts";
import { useSavebarRef } from "./SavebarRefContext";

export interface SavebarProps {
  children: React.ReactNode;
}

export const SavebarRoot = ({ children }: SavebarProps) => {
  const { anchor, setSavebarMounted } = useSavebarRef();

  useEffect(() => {
    setSavebarMounted(true);

    return () => {
      setSavebarMounted(false);
    };
  }, [setSavebarMounted]);

  if (!anchor.current) {
    return null;
  }

  return createPortal(
    <Box __height={savebarHeight} backgroundColor="default1">
      <Box display="flex" alignItems="center" gap={3} paddingX={6} height="100%">
        {children}
      </Box>
    </Box>,
    anchor.current,
  );
};

export const Spacer = () => <Box __flex={1} />;
