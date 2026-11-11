// Adapted from saleor-dashboard: src/products/components/ProductBulkDeleteDialog/ProductBulkDeleteDialog.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's bulk delete confirmation: the dialog title and, per the count, the plural question with
// the number in bold, then Back/Delete as on the single delete dialog.
import { FormattedMessage } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { buttonMessages } from "../../../intl";
import { productBulkDeleteDialogMessages as messages } from "./messages";

interface ProductBulkDeleteDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  count: number;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ProductBulkDeleteDialog = ({
  confirmButtonState,
  count,
  open,
  onClose,
  onConfirm,
}: ProductBulkDeleteDialogProps) => {
  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size="xs">
        <DashboardModal.Header
          subtitle={
            <FormattedMessage
              id={messages.subtitle.id}
              defaultMessage={messages.subtitle.defaultMessage}
              description={messages.subtitle.description}
              values={{
                counter: count,
                displayQuantity: <strong>{count}</strong>,
              }}
            />
          }
        >
          <FormattedMessage
            id={messages.title.id}
            defaultMessage={messages.title.defaultMessage}
            description={messages.title.description}
          />
        </DashboardModal.Header>

        <DashboardModal.Actions>
          <BackButton onClick={onClose} />
          <ConfirmButton
            data-test-id="submit"
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

ProductBulkDeleteDialog.displayName = "ProductBulkDeleteDialog";
