// Adapted from saleor-dashboard: src/orders/components/OrderDetailsPage/OrderDetailsPage.tsx and
// messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order page (owner decision 4 of M6): back link to the list, the title and Saleor's menu with
// "Cancel order" (while nothing is fulfilled), then Saleor's cards in its order — the lines with
// the Fulfill button and the fulfillments, the summary with "Mark as Paid", the transactions with
// their Refund button, the history — and the customer card in the right sidebar. Left out: the
// GraphiQL and metadata entries, draft and unconfirmed orders, invoices, the customer note, app
// widgets and the price breakdown modal.
import { Box } from "@saleor/macaw-ui";
import { Package, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { defineMessage, useIntl } from "react-intl";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { topNavDestinationMessages } from "../../../components/AppLayout/TopNav/destinationMessages";
import { iconSize, iconStrokeWidthBySize, topNavLucideIconProps } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { orderListPath } from "../../urls";
import { OrderCustomer } from "../OrderCustomer/OrderCustomer";
import { OrderDetailsItemsSection } from "../OrderDetailsItemsSection/OrderDetailsItemsSection";
import { OrderHistory } from "../OrderHistory/OrderHistory";
import { OrderSummary } from "../OrderSummary/OrderSummary";
import { OrderTransactionsSection } from "../OrderTransactionsSection/OrderTransactionsSection";
import { Title } from "./Title";

const cancelOrderMessage = defineMessage({
  id: "9ZtJhn",
  defaultMessage: "Cancel order",
  description: "cancel button",
});

/** Saleor's Order.canCancel for our orders: not canceled and nothing fulfilled (PLAN M6 decision 2). */
export const canCancelOrder = (order: Pick<OrderDetailsFragment, "status" | "fulfillments">) =>
  order.status !== "CANCELED" && order.fulfillments.length === 0;

interface OrderDetailsPageProps {
  order?: OrderDetailsFragment;
  onOrderFulfill: () => void;
  onOrderCancel: () => void;
  onMarkAsPaid: () => void;
  /** Absent when the staff can't refund (HANDLE_PAYMENTS). */
  onRefund?: (transactionId: string) => void;
}

export const OrderDetailsPage = ({
  order,
  onOrderFulfill,
  onOrderCancel,
  onMarkAsPaid,
  onRefund,
}: OrderDetailsPageProps) => {
  const intl = useIntl();
  const menuItems = useMemo(
    () =>
      order && canCancelOrder(order)
        ? [
            {
              label: intl.formatMessage(cancelOrderMessage),
              onSelect: onOrderCancel,
              testId: "cancel-order",
              color: "critical1" as const,
              icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
            },
          ]
        : [],
    [intl, onOrderCancel, order],
  );

  return (
    <DetailPageLayout>
      <TopNav
        href={orderListPath}
        hrefIcon={<Package {...topNavLucideIconProps} />}
        hrefTitle={intl.formatMessage(topNavDestinationMessages.allOrders)}
        title={<Title order={order} />}
        actionsGap={3}
      >
        {menuItems.length > 0 && <TopNav.Menu dataTestId="menu" items={menuItems} />}
      </TopNav>
      <DetailPageLayout.Content data-test-id="order-fulfillment">
        {order && (
          <Box display="flex" flexDirection="column" gap={6} paddingTop={6}>
            <OrderDetailsItemsSection order={order} onOrderFulfill={onOrderFulfill} />
            <OrderSummary order={order} onMarkAsPaid={onMarkAsPaid} />
            <OrderTransactionsSection transactions={order.transactions} onRefund={onRefund} />
            <OrderHistory history={order.events} currency={order.total.gross.currency} />
          </Box>
        )}
      </DetailPageLayout.Content>
      <DetailPageLayout.RightSidebar>
        {order && (
          <OrderCustomer
            userEmail={order.userEmail}
            shippingAddress={order.shippingAddress}
            billingAddress={order.billingAddress}
          />
        )}
      </DetailPageLayout.RightSidebar>
    </DetailPageLayout>
  );
};
