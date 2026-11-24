// Adapted from saleor-dashboard: src/collections/components/CollectionDeleteDialog/CollectionDeleteDialog.tsx
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

interface CollectionDeleteDialogProps {
  collectionName: ReactNode;
  confirmButtonState: ConfirmButtonTransitionState;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}

export const CollectionDeleteDialog = ({
  collectionName,
  confirmButtonState,
  onClose,
  onConfirm,
  open,
}: CollectionDeleteDialogProps) => {
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
              id="pVFoOk"
              defaultMessage="Are you sure you want to delete {collectionName}?"
              values={{ collectionName }}
            />
          }
        >
          <FormattedMessage
            id="+wpvnk"
            defaultMessage="Delete Collection"
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

CollectionDeleteDialog.displayName = "CollectionDeleteDialog";
