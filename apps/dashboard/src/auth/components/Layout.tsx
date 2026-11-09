// Adapted from saleor-dashboard: src/auth/components/Layout.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor shows its logo above the form; we show the shop's name there (Saleor's logo is its
// trademark). The background art is Saleor's, with fixed colours as in Saleor (both themes).
import { Text } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import backgroundArt from "../../assets/images/login-background.svg";
import { useShop } from "../../components/Shop";
import styles from "./Layout.module.css";

export const Layout = ({ children }: { children: ReactNode }) => {
  const shop = useShop();

  return (
    <div className={styles.root}>
      <div className={styles.mainPanel}>
        <div className={styles.logo}>
          <Text size={6} fontWeight="bold" lineHeight={3}>
            {shop?.name}
          </Text>
        </div>
        <div className={styles.mainPanelContent}>{children}</div>
      </div>
      <div className={styles.sidebar}>
        <img className={styles.sidebarArt} src={backgroundArt} alt="" />
      </div>
    </div>
  );
};
