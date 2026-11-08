// Adapted from saleor-dashboard: src/components/AppLayout/AppLayout.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import { Sidebar } from "../Sidebar/Sidebar";
import { SidebarProvider } from "../Sidebar/SidebarContext";
import styles from "./AppLayout.module.css";

interface AppLayoutProps {
  children: ReactNode;
}

// Saleor also mounts a loading bar, announcements, the save-bar anchor,
// search and dev panels here; each arrives with the milestone that needs it.
export const AppLayout = ({ children }: AppLayoutProps) => (
  <SidebarProvider>
    <div className={styles.layout}>
      <div className={styles.navigation}>
        <Sidebar />
      </div>
      <Box height="100%" width="100%" overflow="hidden">
        <Box as="main" width="100%" height="100%">
          {children}
        </Box>
      </Box>
    </div>
  </SidebarProvider>
);
