// Adapted from saleor-dashboard: src/products/components/ProductMediaDeleteDialog/ProductMediaDeleteDialog.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's confirmation dialog for deleting one image. Media are images only (ARCHITECTURE §4)
// and deletion is single (owner, M2.5.3a), so the bulk and video variants are not ported.
import { FormattedMessage } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { buttonMessages } from "../../../intl";
import { productMediaDeleteDialogMessages as messages } from "./messages";

interface ProductMediaDeleteDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ProductMediaDeleteDialog = ({
  confirmButtonState,
  open,
  onClose,
  onConfirm,
}: ProductMediaDeleteDialogProps) => {
  const isSubmitting = confirmButtonState === "loading";

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  return (
    <DashboardModal onChange={handleClose} open={open}>
      <DashboardModal.Content size="xs">
        <DashboardModal.Header
          subtitle={<FormattedMessage {...messages.deleteImageConfirmation} />}
        >
          <FormattedMessage {...messages.deleteImageTitle} />
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

ProductMediaDeleteDialog.displayName = "ProductMediaDeleteDialog";
