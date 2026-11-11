// Adapted from saleor-dashboard: src/orders/components/OrderCancelDialog/OrderCancelDialog.tsx and
// messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Cancel order #n": Saleor's reminder that refunds are separate, the API's errors, and Keep
// order / Cancel order. It can't be dismissed while the mutation runs.
import { Text } from "@saleor/macaw-ui";
import type { ReactNode } from "react";
import { defineMessage, defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import type { OrderErrorFragment } from "../../../graphql/types.generated";
import { getOrderErrorMessage } from "../../../utils/errors";

// react-intl's defineMessages cannot infer values; messages with values are typed on their own.
const dialogTitleMessage = defineMessage<{ orderNumber: string }>({
  id: "wmeRVH",
  defaultMessage: "Cancel order #{orderNumber}",
  description: "dialog header",
});

export const cancelOrderDialogMessages = defineMessages({
  buttonKeepOrder: {
    id: "p6ugX0",
    defaultMessage: "Keep order",
    description: "button to keep order",
  },
  buttonCancelOrder: {
    id: "bKTEnb",
    defaultMessage: "Cancel order",
    description: "button to cancel order",
  },
});

interface OrderCancelDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  errors: OrderErrorFragment[];
  number: string;
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export const OrderCancelDialog = ({
  confirmButtonState,
  errors,
  number: orderNumber,
  open,
  onSubmit,
  onClose,
}: OrderCancelDialogProps) => {
  const intl = useIntl();
  const isSubmitting = confirmButtonState === "loading";
  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <DashboardModal onChange={handleClose} open={open}>
      <DashboardModal.Content size="xs">
        <DashboardModal.Header
          data-test-id="dialog-title"
          subtitle={
            <FormattedMessage
              id="NWA+MK"
              defaultMessage="<b>Important:</b> Refunds need to be issued <b>manually</b> after order cancelation."
              description="dialog content"
              values={{ b: (chunks: ReactNode[]) => <b>{chunks}</b> }}
            />
          }
        >
          <FormattedMessage {...dialogTitleMessage} values={{ orderNumber }} />
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
          <BackButton disabled={isSubmitting} onClick={handleClose}>
            <FormattedMessage {...cancelOrderDialogMessages.buttonKeepOrder} />
          </BackButton>
          <ConfirmButton
            data-test-id="submit"
            disabled={isSubmitting}
            onClick={onSubmit}
            transitionState={confirmButtonState}
            variant="error"
          >
            <FormattedMessage {...cancelOrderDialogMessages.buttonCancelOrder} />
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};
