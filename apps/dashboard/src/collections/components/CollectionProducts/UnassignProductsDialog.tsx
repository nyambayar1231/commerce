// Adapted from saleor-dashboard: src/components/ActionDialog/ActionDialog.tsx as CollectionProducts
// uses it (src/collections/components/CollectionProducts/CollectionProducts.tsx)
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's confirm dialog for the bulk unassign: the title, the counted question and Delete/Cancel.
import { FormattedMessage } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { buttonMessages } from "../../../intl";
import { messages } from "./messages";

interface UnassignProductsDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}

export const UnassignProductsDialog = ({
  confirmButtonState,
  count,
  onClose,
  onConfirm,
  open,
}: UnassignProductsDialogProps) => {
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
            <FormattedMessage
              id="AulH/n"
              defaultMessage="{counter,plural,one{Are you sure you want to unassign this product?} other{Are you sure you want to unassign {displayQuantity} products?}}"
              values={{ counter: count, displayQuantity: <strong>{count}</strong> }}
            />
          }
        >
          <FormattedMessage {...messages.unassignDialogTitle} />
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

UnassignProductsDialog.displayName = "UnassignProductsDialog";
