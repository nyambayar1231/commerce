// Adapted from saleor-dashboard: src/orders/components/OrderShippingMethodEditDialog/
// OrderShippingMethodEditDialog.tsx and messages.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Edit Shipping Method": a select of the draft's active shipping methods with their prices.
// Saleor also lists unavailable methods (disabled, with their reason); ours lists active ones only.
import { Box, Select, Text } from "@saleor/macaw-ui";
import { useEffect, useState } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import type { OrderDetailsFragment, OrderErrorFragment } from "../../../graphql/types.generated";
import { getOrderErrorMessage } from "../../../utils/errors";

const messages = defineMessages({
  title: { id: "V/YxJa", defaultMessage: "Edit Shipping Method" },
  confirm: { id: "N2IrpM", defaultMessage: "Confirm" },
});

interface OrderShippingMethodEditDialogProps {
  open: boolean;
  shippingMethods: OrderDetailsFragment["shippingMethods"];
  shippingMethodId: string | null;
  confirmButtonState: ConfirmButtonTransitionState;
  errors: OrderErrorFragment[];
  onClose: () => void;
  onSubmit: (shippingMethodId: string) => void;
}

export const OrderShippingMethodEditDialog = ({
  open,
  shippingMethods,
  shippingMethodId,
  confirmButtonState,
  errors,
  onClose,
  onSubmit,
}: OrderShippingMethodEditDialogProps) => {
  const intl = useIntl();
  const [value, setValue] = useState<string | null>(shippingMethodId);

  useEffect(() => {
    if (open) setValue(shippingMethodId ?? shippingMethods[0]?.id ?? null);
  }, [open, shippingMethodId, shippingMethods]);

  const options = shippingMethods.map((method) => ({
    value: method.id,
    label: `${method.name} - ${intl.formatNumber(method.price.amount, {
      style: "currency",
      currency: method.price.currency,
      maximumFractionDigits: 0,
    })}`,
  }));

  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size="sm">
        <DashboardModal.Header>
          <FormattedMessage {...messages.title} />
        </DashboardModal.Header>
        <DashboardModal.Body>
          <DashboardModal.Inset>
            <Box display="flex" flexDirection="column" gap={4}>
              <Select
                width="100%"
                options={options}
                name="shippingMethod"
                data-test-id="shipping-method-select"
                value={options.find((option) => option.value === value) ?? null}
                onChange={(option) => setValue(option?.value ?? null)}
              />
              {errors.map((error) => (
                <Text
                  key={`${error.code}-${error.field}`}
                  color="critical1"
                  data-test-id="dialog-error"
                >
                  {getOrderErrorMessage(error, intl)}
                </Text>
              ))}
            </Box>
          </DashboardModal.Inset>
        </DashboardModal.Body>
        <DashboardModal.Actions>
          <BackButton onClick={onClose} />
          <ConfirmButton
            transitionState={confirmButtonState}
            disabled={!value}
            data-test-id="confirm-button"
            onClick={() => value && onSubmit(value)}
          >
            <FormattedMessage {...messages.confirm} />
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};
