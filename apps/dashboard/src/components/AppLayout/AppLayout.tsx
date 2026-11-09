// Adapted from saleor-dashboard: src/components/AppLayout/AppLayout.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import { useSavebarRef } from "../Savebar/SavebarRefContext";
import { Sidebar } from "../Sidebar/Sidebar";
import { SidebarProvider } from "../Sidebar/SidebarContext";
import styles from "./AppLayout.module.css";
import { borderHeight, savebarHeight } from "./consts";

interface AppLayoutProps {
  children: ReactNode;
}

// Saleor also mounts a loading bar, announcements, search and dev panels here; each arrives with
// the milestone that needs it.
export const AppLayout = ({ children }: AppLayoutProps) => {
  const { isSavebarMounted, setAnchor } = useSavebarRef();

  return (
    <SidebarProvider>
      <div className={styles.layout}>
        <div className={styles.navigation}>
          <Sidebar />
        </div>
        <Box height="100%" width="100%" overflow="hidden">
          <Box as="main" width="100%" height="100%">
            {children}
          </Box>
          <Box
            ref={setAnchor}
            position="sticky"
            bottom={0}
            left={0}
            right={0}
            backgroundColor="default1"
            borderTopWidth={isSavebarMounted ? 1 : 0}
            borderTopStyle="solid"
            borderColor="default1"
            zIndex="2"
            __height={isSavebarMounted ? savebarHeight : "0"}
            // DetailPageLayout withholds 2× borderHeight (Safari overflow guard); the anchor
            // only adds one border outside its box — overlap so the bar meets sidebar/grid lines.
            __marginTop={isSavebarMounted ? `-${borderHeight}` : 0}
            overflow="hidden"
          />
        </Box>
      </div>
    </SidebarProvider>
  );
};
