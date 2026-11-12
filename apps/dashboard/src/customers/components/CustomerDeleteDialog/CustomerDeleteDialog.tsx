// Copied from saleor-dashboard: src/customers/components/CustomerDeleteDialog/CustomerDeleteDialog.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Confirms deleting one customer; it can't be dismissed while the deletion runs.
import type { ReactNode } from "react";
import { FormattedMessage } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { buttonMessages } from "../../../intl";

interface CustomerDeleteDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  email: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}

export const CustomerDeleteDialog = ({
  confirmButtonState,
  email,
  onClose,
  onConfirm,
  open,
}: CustomerDeleteDialogProps) => {
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
              description="delete customer, dialog content"
              id="2p0tZx"
              defaultMessage="Are you sure you want to delete {email}?"
              values={{ email }}
            />
          }
        >
          <FormattedMessage
            description="dialog header"
            id="ey0lZj"
            defaultMessage="Delete Customer"
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

CustomerDeleteDialog.displayName = "CustomerDeleteDialog";
