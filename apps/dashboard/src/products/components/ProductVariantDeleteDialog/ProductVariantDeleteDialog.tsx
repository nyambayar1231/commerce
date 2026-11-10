// Adapted from saleor-dashboard: src/products/components/ProductVariantDeleteDialog/ProductVariantDeleteDialog.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's variant delete confirmation: title, "Are you sure you want to delete {name}?" and
// Back/Delete. As on the product dialog, it cannot be dismissed while the mutation is in flight.
import { FormattedMessage } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";

interface ProductVariantDeleteDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  name: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ProductVariantDeleteDialog = ({
  confirmButtonState,
  name,
  open,
  onClose,
  onConfirm,
}: ProductVariantDeleteDialogProps) => {
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
              id="WwNtFn"
              defaultMessage="Are you sure you want to delete {name}?"
              description="delete product variant"
              values={{ name: <strong>{name || "..."}</strong> }}
            />
          }
        >
          <FormattedMessage
            id="GFJabu"
            defaultMessage="Delete Variant"
            description="dialog header"
          />
        </DashboardModal.Header>
        <DashboardModal.Actions>
          <BackButton disabled={isSubmitting} onClick={handleClose} />
          <ConfirmButton
            data-test-id="delete-variant-button"
            disabled={isSubmitting}
            onClick={onConfirm}
            transitionState={confirmButtonState}
            variant="error"
          >
            <FormattedMessage id="rbkmfG" defaultMessage="Delete variant" description="button" />
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};

ProductVariantDeleteDialog.displayName = "ProductVariantDeleteDialog";
