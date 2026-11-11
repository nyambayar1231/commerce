// Adapted from saleor-dashboard: src/orders/components/OrderUnfulfilledProductsCard/OrderUnfulfilledProductsCard.tsx
// and OrderCardTitle/OrderCardTitle.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The lines still to fulfil, under Saleor's "Unfulfilled order lines" title. Nothing is shown when
// every line is fulfilled. The Fulfill button arrives with M6.5.
import { useMemo } from "react";
import { FormattedMessage } from "react-intl";

import { DashboardCard } from "../../../components/Card";
import type { OrderLineFragment } from "../../../graphql/types.generated";
import { toLineWithUnfulfilledQuantity } from "../OrderDetailsDatagrid/datagrid";
import { OrderDetailsDatagrid } from "../OrderDetailsDatagrid/OrderDetailsDatagrid";

export const OrderUnfulfilledProductsCard = ({ lines }: { lines: OrderLineFragment[] }) => {
  const unfulfilled = useMemo(() => toLineWithUnfulfilledQuantity(lines), [lines]);

  if (unfulfilled.length === 0) {
    return null;
  }

  return (
    <DashboardCard gap={0} data-test-id="unfulfilled-order-lines">
      <DashboardCard.Header paddingBottom={4}>
        <DashboardCard.Title>
          <FormattedMessage
            defaultMessage="Unfulfilled order lines"
            id="vcMnX2"
            description="unfulfilled fulfillment, section header"
          />
        </DashboardCard.Title>
      </DashboardCard.Header>
      <DashboardCard.Content paddingX={0}>
        <OrderDetailsDatagrid lines={unfulfilled} />
      </DashboardCard.Content>
    </DashboardCard>
  );
};
