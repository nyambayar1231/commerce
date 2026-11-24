// Adapted from saleor-dashboard: src/structures/components/MenuBulkDeleteDialog/MenuBulkDeleteDialog.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { FormattedMessage } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { buttonMessages } from "../../../intl";

interface MenuBulkDeleteDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}

export const MenuBulkDeleteDialog = ({
  confirmButtonState,
  count,
  onClose,
  onConfirm,
  open,
}: MenuBulkDeleteDialogProps) => {
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
              id="aWzvoq"
              defaultMessage="{counter,plural,one{Are you sure you want to delete this structure?} other{Are you sure you want to delete {displayQuantity} structures?}}"
              values={{
                counter: count,
                displayQuantity: <strong>{count}</strong>,
              }}
            />
          }
        >
          <FormattedMessage
            description="dialog header"
            id="wAGThK"
            defaultMessage="Delete structures"
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

MenuBulkDeleteDialog.displayName = "MenuBulkDeleteDialog";
