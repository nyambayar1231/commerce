// Adapted from saleor-dashboard: src/orders/components/OrderDraftDetails/OrderDraftDetails.tsx and
// OrderDraftDetailsProducts/OrderDraftDetailsProducts.tsx (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's order card title "Order lines" with "Add products", a dashed line, then the draft's
// lines: a skeleton while loading, Saleor's placeholder when there are none, else Saleor's
// editable grid (OrderDraftDetailsDatagrid) with Saleor's 24px below it.
// Finalize's errors about a line show in its status cell; the others (no products) in red above
// the grid. Left out: the channel checks on "Add products" (single channel) and its tooltip.
import { Box, Button, Skeleton, Text } from "@saleor/macaw-ui";
import { defineMessages, FormattedMessage } from "react-intl";

import { DashboardCard } from "../../../components/Card";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { Placeholder } from "../../../components/Placeholder/Placeholder";
import type { OrderErrorFragment, OrderLineFragment } from "../../../graphql/types.generated";
import { OrderCardDatagridSeparator, OrderCardTitle } from "../OrderCardTitle/OrderCardTitle";
import { OrderDraftDetailsDatagrid } from "../OrderDraftDetailsDatagrid/OrderDraftDetailsDatagrid";

export const messages = defineMessages({
  title: {
    id: "wL850U",
    defaultMessage: "Order lines",
    description: "draft order lines, section header",
  },
  addProducts: {
    id: "C50ahv",
    defaultMessage: "Add products",
    description: "button",
  },
  emptyText: { id: "Q1Uzbb", defaultMessage: "No products found" },
});

interface OrderDraftDetailsProps {
  lines?: OrderLineFragment[];
  disabled: boolean;
  /** Finalize's errors about the lines; those naming lines show in the grid. */
  lineErrors?: OrderErrorFragment[];
  /** Finalize's other errors about the lines (e.g. no products), shown in red. */
  errors?: string[];
  orderLineRemoveConfirmState?: ConfirmButtonTransitionState;
  orderLineRemoveErrors?: OrderErrorFragment[];
  onOrderLineAdd: () => void;
  onOrderLineChange: (lineId: string, quantity: number) => Promise<unknown>;
  onOrderLineRemove: (lineId: string) => Promise<boolean>;
}

export const OrderDraftDetails = ({
  lines,
  disabled,
  lineErrors = [],
  errors = [],
  orderLineRemoveConfirmState,
  orderLineRemoveErrors,
  onOrderLineAdd,
  onOrderLineChange,
  onOrderLineRemove,
}: OrderDraftDetailsProps) => {
  const hasLines = (lines?.length ?? 0) > 0;

  return (
    <DashboardCard gap={0} data-test-id="draft-order-lines">
      <OrderCardTitle
        title={<FormattedMessage {...messages.title} />}
        toolbar={
          <Button
            variant="secondary"
            onClick={onOrderLineAdd}
            disabled={disabled}
            data-test-id="add-products-button"
          >
            <FormattedMessage {...messages.addProducts} />
          </Button>
        }
      />
      {errors.length > 0 && (
        <DashboardCard.Content paddingBottom={2} data-test-id="lines-errors">
          {errors.map((error) => (
            <Text key={error} color="critical1" size={3} display="block">
              {error}
            </Text>
          ))}
        </DashboardCard.Content>
      )}
      {hasLines && <OrderCardDatagridSeparator />}
      <DashboardCard.Content {...(hasLines ? { paddingX: 0 } : { paddingBottom: 6 })}>
        {lines === undefined ? (
          <Skeleton />
        ) : hasLines ? (
          <OrderDraftDetailsDatagrid
            lines={lines}
            errors={lineErrors}
            orderLineRemoveConfirmState={orderLineRemoveConfirmState}
            orderLineRemoveErrors={orderLineRemoveErrors}
            onOrderLineChange={onOrderLineChange}
            onOrderLineRemove={onOrderLineRemove}
          />
        ) : (
          <Placeholder>
            <FormattedMessage {...messages.emptyText} />
          </Placeholder>
        )}
        {hasLines && <Box backgroundColor="default1" paddingBottom={6} />}
      </DashboardCard.Content>
    </DashboardCard>
  );
};
