// Adapted from saleor-dashboard: src/orders/components/OrderDetailsPage/OrderDetailsPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The read-only order page (owner decision 4 of M6): back link to the list, the title, then
// Saleor's cards in its order — unfulfilled lines, summary, transactions, history — and the
// customer card in the right sidebar. Left out: the menu (cancel arrives with M6.5; no GraphiQL or
// metadata), fulfillments (M6.4/M6.5), draft and unconfirmed orders, invoices, the customer note,
// app widgets and the price breakdown modal.
import { Box } from "@saleor/macaw-ui";
import { Package } from "lucide-react";
import { useIntl } from "react-intl";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { topNavDestinationMessages } from "../../../components/AppLayout/TopNav/destinationMessages";
import { topNavLucideIconProps } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { orderListPath } from "../../urls";
import { OrderCustomer } from "../OrderCustomer/OrderCustomer";
import { OrderHistory } from "../OrderHistory/OrderHistory";
import { OrderSummary } from "../OrderSummary/OrderSummary";
import { OrderTransactionsSection } from "../OrderTransactionsSection/OrderTransactionsSection";
import { OrderUnfulfilledProductsCard } from "../OrderUnfulfilledProductsCard/OrderUnfulfilledProductsCard";
import { Title } from "./Title";

export const OrderDetailsPage = ({ order }: { order?: OrderDetailsFragment }) => {
  const intl = useIntl();

  return (
    <DetailPageLayout>
      <TopNav
        href={orderListPath}
        hrefIcon={<Package {...topNavLucideIconProps} />}
        hrefTitle={intl.formatMessage(topNavDestinationMessages.allOrders)}
        title={<Title order={order} />}
        actionsGap={3}
      />
      <DetailPageLayout.Content data-test-id="order-fulfillment">
        {order && (
          <Box display="flex" flexDirection="column" gap={6} paddingTop={6}>
            <OrderUnfulfilledProductsCard lines={order.lines} />
            <OrderSummary order={order} />
            <OrderTransactionsSection transactions={order.transactions} />
            <OrderHistory history={order.events} />
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
