// Adapted from saleor-dashboard: src/orders/components/OrderDraftCancelDialog/OrderDraftCancelDialog.tsx
// and messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Delete Draft Order": the page menu's "Cancel order" for a draft deletes it (draftOrderDelete).
import { Text } from "@saleor/macaw-ui";
import type { ReactNode } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import type { OrderErrorFragment } from "../../../graphql/types.generated";
import { buttonMessages } from "../../../intl";
import { getOrderErrorMessage } from "../../../utils/errors";

const messages = defineMessages({
  dialogTitle: {
    id: "Yk0avO",
    defaultMessage: "Delete Draft Order",
    description: "dialog header",
  },
  buttonKeepDraft: {
    id: "uU1mx5",
    defaultMessage: "Keep draft",
    description: "button",
  },
});

interface OrderDraftCancelDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  errors: OrderErrorFragment[];
  open: boolean;
  orderNumber: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const OrderDraftCancelDialog = ({
  confirmButtonState,
  errors,
  open,
  orderNumber,
  onClose,
  onConfirm,
}: OrderDraftCancelDialogProps) => {
  const intl = useIntl();

  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size="xs">
        <DashboardModal.Header
          subtitle={
            <FormattedMessage
              id="aHasbu"
              defaultMessage="Are you sure you want to delete draft <b>{orderNumber}</b>?"
              description="dialog content"
              values={{ orderNumber, b: (chunks: ReactNode[]) => <b>{chunks}</b> }}
            />
          }
        >
          <FormattedMessage {...messages.dialogTitle} />
        </DashboardModal.Header>
        {errors.length > 0 && (
          <DashboardModal.Body>
            <DashboardModal.Inset>
              {errors.map((error) => (
                <Text
                  display="block"
                  color="critical1"
                  key={`${error.code}-${error.field}`}
                  data-test-id="dialog-error"
                >
                  {getOrderErrorMessage(error, intl)}
                </Text>
              ))}
            </DashboardModal.Inset>
          </DashboardModal.Body>
        )}
        <DashboardModal.Actions>
          <BackButton onClick={onClose}>
            <FormattedMessage {...messages.buttonKeepDraft} />
          </BackButton>
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
