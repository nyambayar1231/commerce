// Adapted from saleor-dashboard: src/orders/components/OrderMarkAsPaidDialog/OrderMarkAsPaidDialog.tsx
// and messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Mark Order as Paid" with an optional transaction reference and the API's errors.
import { Box, Input, Text } from "@saleor/macaw-ui";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import type { OrderErrorFragment } from "../../../graphql/types.generated";
import { getOrderErrorMessage } from "../../../utils/errors";

export const messages = defineMessages({
  title: {
    id: "+B25o/",
    defaultMessage: "Mark Order as Paid",
    description: "dialog header",
  },
  intro: {
    id: "sfEbeB",
    defaultMessage: "You're going to mark this order as paid.",
  },
  transactionReferenceHint: {
    id: "rwOx2s",
    defaultMessage: "Please provide a transaction reference using the input below:",
  },
  transactionReference: {
    id: "EbVf0Z",
    defaultMessage: "Transaction reference",
    description: "transaction reference",
  },
  markAsPaid: {
    defaultMessage: "Mark as Paid",
    description: "Button to manually mark order as paid without actual payment",
    id: "SDgGcU",
  },
});

interface OrderMarkAsPaidDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  errors: OrderErrorFragment[];
  open: boolean;
  transactionReference: string;
  onClose: () => void;
  onConfirm: () => void;
  onTransactionReferenceChange: (value: string) => void;
}

export const OrderMarkAsPaidDialog = ({
  confirmButtonState,
  errors,
  open,
  transactionReference,
  onClose,
  onConfirm,
  onTransactionReferenceChange,
}: OrderMarkAsPaidDialogProps) => {
  const intl = useIntl();
  const isSubmitting = confirmButtonState === "loading";
  const referenceError = errors.find((error) => error.field === "transactionReference");
  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <DashboardModal onChange={handleClose} open={open}>
      <DashboardModal.Content size="xs">
        <DashboardModal.Header
          subtitle={
            <>
              <FormattedMessage {...messages.intro} />{" "}
              <FormattedMessage {...messages.transactionReferenceHint} />
            </>
          }
        >
          <FormattedMessage {...messages.title} />
        </DashboardModal.Header>

        <DashboardModal.Body>
          <DashboardModal.Inset>
            <Box display="flex" flexDirection="column" gap={4}>
              <Input
                error={!!referenceError}
                aria-invalid={!!referenceError}
                helperText={getOrderErrorMessage(referenceError, intl)}
                name="transactionReference"
                label={intl.formatMessage(messages.transactionReference)}
                value={transactionReference}
                onChange={(event) => onTransactionReferenceChange(event.target.value)}
                data-test-id="transaction-reference-input"
              />
              {errors
                .filter((error) => error.field !== "transactionReference")
                .map((error) => (
                  <Text
                    display="block"
                    color="critical1"
                    key={`${error.code}-${error.field}`}
                    data-test-id="dialog-error"
                  >
                    {getOrderErrorMessage(error, intl)}
                  </Text>
                ))}
            </Box>
          </DashboardModal.Inset>
        </DashboardModal.Body>

        <DashboardModal.Actions>
          <BackButton disabled={isSubmitting} onClick={handleClose} />
          <ConfirmButton
            data-test-id="submit"
            disabled={isSubmitting}
            onClick={onConfirm}
            transitionState={confirmButtonState}
          >
            <FormattedMessage {...messages.markAsPaid} />
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};
