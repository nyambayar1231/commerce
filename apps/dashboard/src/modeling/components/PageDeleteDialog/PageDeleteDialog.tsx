// Adapted from saleor-dashboard: src/modeling/components/PageDeleteDialog/PageDeleteDialog.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { ReactNode } from "react";
import { FormattedMessage } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { buttonMessages } from "../../../intl";

interface PageDeleteDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  title: ReactNode;
}

export const PageDeleteDialog = ({
  confirmButtonState,
  onClose,
  onConfirm,
  open,
  title,
}: PageDeleteDialogProps) => {
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
        <DashboardModal.Header subtitle={title}>
          <FormattedMessage description="dialog header" id="0B0HS2" defaultMessage="Delete model" />
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

PageDeleteDialog.displayName = "PageDeleteDialog";
