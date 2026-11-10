// Adapted from saleor-dashboard: src/products/components/ProductDeleteDialog/ProductDeleteDialog.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's delete confirmation: title, "Are you sure you want to delete {name}?" and Back/Delete.
// The dialog cannot be dismissed while the mutation is in flight.
import { defineMessages, FormattedMessage } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { buttonMessages } from "../../../intl";

const messages = defineMessages({
  title: {
    id: "TWVx7O",
    defaultMessage: "Delete Product",
    description: "delete product dialog title",
  },
});

interface ProductDeleteDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  name: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ProductDeleteDialog = ({
  confirmButtonState,
  name,
  open,
  onClose,
  onConfirm,
}: ProductDeleteDialogProps) => {
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
              id="ZHF4Z9"
              defaultMessage="Are you sure you want to delete {name}?"
              description="delete product dialog subtitle"
              values={{ name: <strong>{name || "..."}</strong> }}
            />
          }
        >
          <FormattedMessage {...messages.title} />
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

ProductDeleteDialog.displayName = "ProductDeleteDialog";
