// Adapted from saleor-dashboard: src/categories/components/CategoryDeleteDialog/CategoryDeleteDialog.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box } from "@saleor/macaw-ui";
import type { ReactNode } from "react";
import { FormattedMessage } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { buttonMessages } from "../../../intl";

interface CategoryDeleteDialogProps {
  categoryName: ReactNode;
  confirmButtonState: ConfirmButtonTransitionState;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}

export const CategoryDeleteDialog = ({
  categoryName,
  confirmButtonState,
  onClose,
  onConfirm,
  open,
}: CategoryDeleteDialogProps) => {
  const isSubmitting = confirmButtonState === "loading";

  const handleClose = (): void => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  return (
    <DashboardModal onChange={handleClose} open={open}>
      <DashboardModal.Content size="xs">
        <DashboardModal.Header
          subtitle={
            <Box display="grid" gap={2}>
              <Box>
                <FormattedMessage
                  id="xRkj2h"
                  defaultMessage="Are you sure you want to delete {categoryName}?"
                  values={{ categoryName }}
                />
              </Box>
              <Box>
                <FormattedMessage
                  id="3DGvA/"
                  defaultMessage="Remember this will also unpin all products assigned to this category, making them unavailable in storefront."
                />
              </Box>
            </Box>
          }
        >
          <FormattedMessage
            id="xo5UIb"
            defaultMessage="Delete category"
            description="dialog title"
          />
        </DashboardModal.Header>
        <DashboardModal.Actions>
          <BackButton disabled={isSubmitting} onClick={handleClose} />
          <ConfirmButton
            data-test-id="submit"
            disabled={isSubmitting}
            onClick={onConfirm}
            transitionState={confirmButtonState}
            variant="error"
          >
            <FormattedMessage {...buttonMessages.delete} />
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};

CategoryDeleteDialog.displayName = "CategoryDeleteDialog";
