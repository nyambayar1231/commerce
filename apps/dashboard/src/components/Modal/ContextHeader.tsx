// Adapted from saleor-dashboard: src/components/Modal/ContextHeader.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Without Saleor's multi-step header (`steps`), which no dialog here uses yet.
import { Box, Text } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import { Close } from "./Close";
import styles from "./ContextHeader.module.css";
import modalStyles from "./DashboardModal.module.css";
import { ModalChromeHeader } from "./ModalChromeHeader";
import { ModalDivider } from "./ModalDivider";
import { MODAL_CONTEXT_HEADER_DISPLAY_NAME } from "./modalDisplayNames";
import { Title } from "./Title";
import { MODAL_HEADER_DIVIDER_GAP_SPACING } from "./tokens";

interface ContextHeaderProps {
  children: ReactNode;
  contextLabel?: ReactNode;
  description?: ReactNode;
  /** When false, renders description without default body text styling (e.g. thumbnail rows). */
  wrapDescription?: boolean;
  /** When false, renders contextLabel inline without the default badge chrome. */
  wrapContextLabel?: boolean;
}

export const ContextHeader = ({
  children,
  contextLabel,
  description,
  wrapDescription = true,
  wrapContextLabel = true,
}: ContextHeaderProps) => {
  return (
    <Box
      className={modalStyles.modalChromeHeaderWrapper}
      display="flex"
      flexDirection="column"
      flexShrink="0"
      gap={MODAL_HEADER_DIVIDER_GAP_SPACING}
    >
      <ModalChromeHeader alignItems="flex-start">
        <Box display="flex" flexDirection="column" gap={3} minWidth={0}>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Title>{children}</Title>
            {contextLabel ? (
              wrapContextLabel ? (
                <Box className={styles.contextBadge} paddingX={2} paddingY={0.5}>
                  {contextLabel}
                </Box>
              ) : (
                contextLabel
              )
            ) : null}
          </Box>
          {description ? (
            <Box>
              {wrapDescription ? (
                <Text size={2} color="default2">
                  {description}
                </Text>
              ) : (
                description
              )}
            </Box>
          ) : null}
        </Box>
        <Close />
      </ModalChromeHeader>
      <ModalDivider />
    </Box>
  );
};

ContextHeader.displayName = MODAL_CONTEXT_HEADER_DISPLAY_NAME;
