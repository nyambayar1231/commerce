// Adapted from saleor-dashboard: src/orders/components/OrderDraftLineRemoveDialog/
// OrderDraftLineRemoveDialog.tsx and messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor
// Commerce)
// See THIRD_PARTY_LICENSES.md
// "Remove product": the line menu's confirmation before a line leaves the draft. It can't be
// closed while the removal runs; the removal's errors show inside it.
import { Text } from "@saleor/macaw-ui";
import { defineMessage, defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import type { OrderErrorFragment } from "../../../graphql/types.generated";
import { getOrderErrorMessage } from "../../../utils/errors";

// react-intl's defineMessages cannot infer values; a message with values is typed on its own.
const subtitleMessage = defineMessage<{ productName: string }>({
  id: "th06kZ",
  defaultMessage: "Are you sure you want to remove {productName} from this draft order?",
  description: "dialog body asking to confirm product removal from draft order",
});

const messages = defineMessages({
  title: {
    id: "fdJjic",
    defaultMessage: "Remove product",
    description: "dialog title for removing product from draft order",
  },
  keepProductButton: {
    id: "uY8rPp",
    defaultMessage: "Keep product",
    description: "button label to cancel product removal",
  },
  removeProductButton: {
    id: "McotWC",
    defaultMessage: "Remove product",
    description: "button label to confirm product removal",
  },
});

interface OrderDraftLineRemoveDialogProps {
  confirmButtonState?: ConfirmButtonTransitionState;
  errors?: OrderErrorFragment[];
  open: boolean;
  productName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const OrderDraftLineRemoveDialog = ({
  confirmButtonState = "default",
  errors = [],
  open,
  productName,
  onClose,
  onConfirm,
}: OrderDraftLineRemoveDialogProps) => {
  const intl = useIntl();
  const isSubmitting = confirmButtonState === "loading";

  const handleClose = (): void => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  return (
    <DashboardModal onChange={handleClose} open={open}>
      <DashboardModal.Content size="xs" data-test-id="remove-line-dialog">
        <DashboardModal.Header subtitle={intl.formatMessage(subtitleMessage, { productName })}>
          <FormattedMessage {...messages.title} />
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
                  {getOrderErrorMessage(error, intl) ?? error.message}
                </Text>
              ))}
            </DashboardModal.Inset>
          </DashboardModal.Body>
        )}

        <DashboardModal.Actions>
          <BackButton disabled={isSubmitting} onClick={handleClose}>
            <FormattedMessage {...messages.keepProductButton} />
          </BackButton>
          <ConfirmButton
            data-test-id="submit"
            disabled={isSubmitting}
            onClick={onConfirm}
            transitionState={confirmButtonState}
            variant="error"
          >
            <FormattedMessage {...messages.removeProductButton} />
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};
