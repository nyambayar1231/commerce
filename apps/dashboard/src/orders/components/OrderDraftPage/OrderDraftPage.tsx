// Adapted from saleor-dashboard: src/orders/components/OrderDraftPage/OrderDraftPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A draft order (PLAN M13.6): back link to the drafts, "Order #n" with the Draft pill, Saleor's
// menu with "Cancel order" (deletes the draft), the lines with "Add products", the summary, the
// history, the customer card and the save bar's Back / Finalize. The customer and the billing
// address are editable (M13.7); the shop doesn't ship yet, so there is no shipping to set (owner,
// 2026-11-14). Finalize's errors show in red next to what is missing. Left out: metadata, the channel alert, discounts, notes,
// app widgets.
import { Box } from "@saleor/macaw-ui";
import { Package, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { defineMessages, type IntlShape, useIntl } from "react-intl";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { topNavDestinationMessages } from "../../../components/AppLayout/TopNav/destinationMessages";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { iconSize, iconStrokeWidthBySize, topNavLucideIconProps } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import type { OrderDetailsFragment, OrderErrorFragment } from "../../../graphql/types.generated";
import { getOrderErrorMessage } from "../../../utils/errors";
import { orderDraftListUrl } from "../../urls";
import { type CustomerChange, OrderCustomer } from "../OrderCustomer/OrderCustomer";
import { Title } from "../OrderDetailsPage/Title";
import { OrderDraftDetails } from "../OrderDraftDetails/OrderDraftDetails";
import { OrderHistory } from "../OrderHistory/OrderHistory";
import { OrderSummary } from "../OrderSummary/OrderSummary";

const messages = defineMessages({
  cancelOrder: {
    id: "9ZtJhn",
    defaultMessage: "Cancel order",
    description: "cancel button",
  },
  finalize: {
    id: "4Z14xW",
    defaultMessage: "Finalize",
    description: "button",
  },
  customerRequired: {
    id: "Dwm3a0",
    defaultMessage: "Choose a customer or type their email before finalizing.",
    description: "draft finalize error",
  },
  linesRequired: {
    id: "zrqtWp",
    defaultMessage: "Add at least one product before finalizing.",
    description: "draft finalize error",
  },
  billingRequired: {
    id: "JcYCB/",
    defaultMessage: "Add a billing address before finalizing.",
    description: "draft finalize error",
  },
});

/** Finalize's errors, by where the page shows them: the customer, the billing address, the lines. */
export const groupFinalizeErrors = (errors: readonly OrderErrorFragment[], intl: IntlShape) => {
  const customer = errors.find((error) => error.field === "userEmail");
  const billing = errors.find((error) => error.field === "billingAddress");
  const rest = errors.filter((error) => error !== customer && error !== billing);

  return {
    customer: customer ? intl.formatMessage(messages.customerRequired) : undefined,
    billingAddress: billing ? intl.formatMessage(messages.billingRequired) : undefined,
    lines: rest.map((error) =>
      error.field === "lines" && error.code === "REQUIRED"
        ? intl.formatMessage(messages.linesRequired)
        : (getOrderErrorMessage(error, intl) ?? error.message ?? ""),
    ),
  };
};

interface OrderDraftPageProps {
  order?: OrderDetailsFragment;
  disabled: boolean;
  finalizeState: ConfirmButtonTransitionState;
  onBack: () => void;
  onDraftFinalize: () => void;
  onDraftRemove: () => void;
  onOrderLineAdd: () => void;
  onOrderLineChange: (lineId: string, quantity: number) => void;
  onOrderLineRemove: (lineId: string) => void;
  onCustomerChange: (change: CustomerChange) => void;
  onBillingAddressEdit: () => void;
  /** Finalize's errors that the draft still has. */
  errors: OrderErrorFragment[];
}

export const OrderDraftPage = ({
  order,
  disabled,
  finalizeState,
  onBack,
  onDraftFinalize,
  onDraftRemove,
  onOrderLineAdd,
  onOrderLineChange,
  onOrderLineRemove,
  onCustomerChange,
  onBillingAddressEdit,
  errors,
}: OrderDraftPageProps) => {
  const intl = useIntl();
  const fieldErrors = groupFinalizeErrors(errors, intl);
  const menuItems = useMemo(
    () => [
      {
        label: intl.formatMessage(messages.cancelOrder),
        onSelect: onDraftRemove,
        testId: "cancel-order",
        color: "critical1" as const,
        icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
      },
    ],
    [intl, onDraftRemove],
  );

  return (
    <DetailPageLayout>
      <TopNav
        href={orderDraftListUrl()}
        hrefIcon={<Package {...topNavLucideIconProps} />}
        hrefTitle={intl.formatMessage(topNavDestinationMessages.allOrders)}
        title={<Title order={order} />}
        actionsGap={3}
      >
        {order && <TopNav.Menu dataTestId="menu" items={menuItems} />}
      </TopNav>
      <DetailPageLayout.Content data-test-id="draft-order-page">
        <Box display="flex" flexDirection="column" gap={6} paddingTop={6}>
          <OrderDraftDetails
            lines={order?.lines}
            disabled={disabled}
            errors={fieldErrors.lines}
            onOrderLineAdd={onOrderLineAdd}
            onOrderLineChange={onOrderLineChange}
            onOrderLineRemove={onOrderLineRemove}
          />
          {order && (
            <>
              <OrderSummary order={order} />
              <OrderHistory history={order.events ?? []} currency={order.total.gross.currency} />
            </>
          )}
        </Box>
      </DetailPageLayout.Content>
      <DetailPageLayout.RightSidebar>
        {order && (
          <OrderCustomer
            userEmail={order.userEmail}
            user={order.user}
            shippingAddress={order.shippingAddress}
            billingAddress={order.billingAddress}
            onCustomerChange={onCustomerChange}
            onBillingAddressEdit={onBillingAddressEdit}
            errors={fieldErrors}
          />
        )}
      </DetailPageLayout.RightSidebar>
      <Savebar>
        <Savebar.Spacer />
        <Savebar.CancelButton onClick={onBack} />
        <Savebar.ConfirmButton
          transitionState={finalizeState}
          onClick={onDraftFinalize}
          disabled={!order || disabled}
          data-test-id="finalize-button"
        >
          {intl.formatMessage(messages.finalize)}
        </Savebar.ConfirmButton>
      </Savebar>
    </DetailPageLayout>
  );
};
