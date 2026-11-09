// Adapted from saleor-dashboard: src/components/DetailSettingsCard/DetailSettingsCard.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The title/subtitle/intro/content card. Saleor's `headerEnd` actions (coerceHeaderEndActions) and
// the optional-label helpers come with the first card that uses them.
import { Box, Text } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import styles from "./DetailSettingsCard.module.css";

interface DetailSettingsCardProps {
  title: ReactNode;
  /** Short line under the title in the header band (status, counts). Prefer `intro` for longer leading copy. */
  subtitle?: ReactNode;
  /** Leading description below the header — bordered intro row (payment gateways pattern). */
  intro?: ReactNode;
  children: ReactNode;
  /** Drop content padding so list rows can use full-bleed dividers. */
  contentFlush?: boolean;
  /** Let menus and popovers paint outside the card. */
  allowOverflow?: boolean;
  "data-test-id"?: string;
}

export const DetailSettingsCardIntro = ({ children }: { children: ReactNode }): ReactNode => (
  <Box className={styles.intro}>{children}</Box>
);

export const DetailSettingsCard = ({
  title,
  subtitle,
  intro,
  children,
  contentFlush = false,
  allowOverflow = false,
  "data-test-id": dataTestId,
}: DetailSettingsCardProps): ReactNode => (
  <Box
    className={[styles.card, allowOverflow && styles.cardVisible].filter(Boolean).join(" ")}
    data-test-id={dataTestId}
  >
    <Box className={styles.header}>
      <Box className={styles.headerMain}>
        <Text size={5} fontWeight="bold" as="h2" className={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text size={3} color="default2">
            {subtitle}
          </Text>
        ) : null}
      </Box>
    </Box>
    {intro ? <DetailSettingsCardIntro>{intro}</DetailSettingsCardIntro> : null}
    <Box className={contentFlush ? styles.contentFlush : styles.content}>{children}</Box>
  </Box>
);

DetailSettingsCard.displayName = "DetailSettingsCard";
