// Adapted from saleor-dashboard: src/orders/components/OrderTransactionActionDialog/
// OrderTransactionActionDialog.tsx and messages.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The refund on a transaction tile (PLAN M6 decision 1): Saleor's "Transaction refund" confirmation
// plus an amount input — prefilled with what is left to refund — because our refund takes an
// amount (Saleor refunds through its grant/send-refund pages instead). Amounts have no minor digits
// (MNT, ADR-0013).
import { Box, Input, Text } from "@saleor/macaw-ui";
import { defineMessage, defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { getCommonFormFieldErrorMessage } from "../../../utils/errors";

// react-intl's defineMessages cannot infer values; messages with values are typed on their own.
const titleMessage = defineMessage<{ actionType: string }>({
  defaultMessage: "Transaction {actionType}",
  id: "3zdm8A",
  description: "Dialog title",
});
const warningMessage = defineMessage<{ actionType: string }>({
  defaultMessage: "Are you sure you want to {actionType} this transaction?",
  id: "VyKl39",
  description: "Dialog warning text",
});
const maxAmountMessage = defineMessage<{ amount: string }>({
  id: "0lAlsM",
  defaultMessage: "Up to {amount} can be refunded.",
  description: "refund amount input helper",
});

export const messages = defineMessages({
  refund: {
    defaultMessage: "Refund",
    description: "Transaction refund button - return captured amount to client",
    id: "8HmEqK",
  },
  amount: {
    id: "cn2ZOU",
    defaultMessage: "Amount to refund",
    description: "refund amount input label",
  },
});

export interface RefundDialogError {
  field: string | null;
  code: string;
  message: string;
}

interface OrderTransactionRefundDialogProps {
  open: boolean;
  confirmButtonState: ConfirmButtonTransitionState;
  /** Charged and not yet refunded, in the transaction's currency. */
  maxAmount: { amount: number; currency: string };
  amount: string;
  errors: RefundDialogError[];
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

/** A positive whole amount no greater than `max`; the API caps and validates it again. */
export const isValidRefundAmount = (amount: string, max: number): boolean =>
  /^\d+$/.test(amount.trim()) && Number(amount) > 0 && Number(amount) <= max;

export const OrderTransactionRefundDialog = ({
  open,
  confirmButtonState,
  maxAmount,
  amount,
  errors,
  onAmountChange,
  onClose,
  onSubmit,
}: OrderTransactionRefundDialogProps) => {
  const intl = useIntl();
  const isSubmitting = confirmButtonState === "loading";
  const actionType = intl.formatMessage(messages.refund).toLowerCase();
  const amountError = errors.find((error) => error.field === "amount");
  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <DashboardModal open={open} onChange={handleClose}>
      <DashboardModal.Content size="xs">
        <DashboardModal.Header
          subtitle={<FormattedMessage {...warningMessage} values={{ actionType }} />}
        >
          <FormattedMessage {...titleMessage} values={{ actionType }} />
        </DashboardModal.Header>

        <DashboardModal.Body>
          <DashboardModal.Inset>
            <Box display="flex" flexDirection="column" gap={4}>
              <Input
                type="number"
                min={1}
                max={maxAmount.amount}
                step={1}
                name="amount"
                label={intl.formatMessage(messages.amount)}
                value={amount}
                endAdornment={<Text color="default2">{maxAmount.currency}</Text>}
                error={!!amountError}
                helperText={
                  amountError
                    ? getCommonFormFieldErrorMessage(amountError, intl)
                    : intl.formatMessage(maxAmountMessage, {
                        amount: intl.formatNumber(maxAmount.amount, {
                          style: "currency",
                          currency: maxAmount.currency,
                          maximumFractionDigits: 0,
                        }),
                      })
                }
                onChange={(event) => onAmountChange(event.target.value)}
                data-test-id="refund-amount-input"
              />
              {errors
                .filter((error) => error.field !== "amount")
                .map((error) => (
                  <Text
                    display="block"
                    color="critical1"
                    key={`${error.code}-${error.field}`}
                    data-test-id="dialog-error"
                  >
                    {getCommonFormFieldErrorMessage(error, intl)}
                  </Text>
                ))}
            </Box>
          </DashboardModal.Inset>
        </DashboardModal.Body>

        <DashboardModal.Actions>
          <BackButton data-test-id="back" disabled={isSubmitting} onClick={handleClose} />
          <ConfirmButton
            data-test-id="submit"
            onClick={onSubmit}
            transitionState={confirmButtonState}
            disabled={isSubmitting || !isValidRefundAmount(amount, maxAmount.amount)}
          >
            {intl.formatMessage(messages.refund)}
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};
