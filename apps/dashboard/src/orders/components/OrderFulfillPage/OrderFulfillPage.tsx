// Adapted from saleor-dashboard: src/orders/components/OrderFulfillPage/OrderFulfillPage.tsx,
// messages.ts and OrderFulfillLine/OrderFulfillLine.tsx (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Order no. n - Add Fulfillment": each line left to fulfil with its quantity (prefilled with all
// that is left), the stock available in the warehouse and the warehouse, then the save bar's
// Fulfill. One warehouse in this project (PLAN M6 decision 2), so the warehouse is shown, not
// picked (no change-warehouse dialog). Left out: tracking number and "send fulfillment details"
// (no tracking or emails), the stock-exceeded dialog (no allowStockToBeExceeded), the single-line
// entry from the line matrix and unpaid-order checks (we have no fulfil-unpaid setting).
import { Box, Skeleton, Text } from "@saleor/macaw-ui";
import { Package } from "lucide-react";
import { useEffect, useState } from "react";
import { defineMessage, defineMessages, FormattedMessage, useIntl } from "react-intl";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { topNavDestinationMessages } from "../../../components/AppLayout/TopNav/destinationMessages";
import { DashboardCard } from "../../../components/Card";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { topNavLucideIconProps } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { QuantityInput } from "../../../components/QuantityInput";
import { Savebar } from "../../../components/Savebar";
import type { OrderFulfillDataQuery } from "../../../graphql/types.generated";
import {
  canSubmitFulfillment,
  type FulfillFormLine,
  type FulfillWarehouse,
  getAvailableQuantity,
  getToFulfillLines,
  initialFormLines,
} from "../../fulfill";
import { orderUrl } from "../../urls";
import styles from "./OrderFulfillPage.module.css";

const headerMessage = defineMessage<{ orderNumber: string }>({
  id: "CJpx4E",
  defaultMessage: "Order no. {orderNumber} - Add Fulfillment",
  description: "page header",
});

const messages = defineMessages({
  submitFulfillment: {
    id: "BLX9dz",
    defaultMessage: "Fulfill",
    description: "fulfill order, button",
  },
  itemsReadyToShip: {
    id: "N5UuEK",
    defaultMessage: "Items ready to ship",
    description: "header",
  },
  itemReadyToShip: {
    id: "e3NyeN",
    defaultMessage: "Item ready to ship",
    description: "fulfill card title for a single line",
  },
  productName: {
    id: "vW3tb6",
    defaultMessage: "Product name",
    description: "name",
  },
  sku: {
    id: "fw+VAN",
    defaultMessage: "SKU",
    description: "product's sku",
  },
  quantity: {
    defaultMessage: "Quantity",
    id: "0mhR+F",
    description: "Header row quantity label",
  },
  stock: {
    defaultMessage: "Stock",
    id: "tZnV8L",
    description: "Header row stock label",
  },
  warehouse: {
    defaultMessage: "Warehouse",
    id: "J0lNnk",
    description: "column label",
  },
});

export type OrderFulfillOrder = NonNullable<OrderFulfillDataQuery["order"]>;

interface OrderFulfillPageProps {
  order?: OrderFulfillOrder;
  warehouses: FulfillWarehouse[];
  saveButtonBar: ConfirmButtonTransitionState;
  onSubmit: (form: FulfillFormLine[]) => void;
  onCancel: () => void;
}

export const OrderFulfillPage = ({
  order,
  warehouses,
  saveButtonBar,
  onSubmit,
  onCancel,
}: OrderFulfillPageProps) => {
  const intl = useIntl();
  const lines = order ? getToFulfillLines(order.lines) : [];
  const [form, setForm] = useState<FulfillFormLine[]>([]);

  // Prefill once the order and warehouses are loaded.
  useEffect(() => {
    if (order) setForm(initialFormLines(getToFulfillLines(order.lines), warehouses));
  }, [order, warehouses]);

  const setQuantity = (lineId: string, quantity: number) =>
    setForm((rows) => rows.map((row) => (row.lineId === lineId ? { ...row, quantity } : row)));

  return (
    <DetailPageLayout gridTemplateColumns={1}>
      <TopNav
        href={order ? orderUrl(order.id) : "/orders"}
        hrefIcon={<Package {...topNavLucideIconProps} />}
        hrefTitle={intl.formatMessage(topNavDestinationMessages.order)}
        title={order ? intl.formatMessage(headerMessage, { orderNumber: order.number }) : "..."}
      />
      <DetailPageLayout.Content>
        <DashboardCard>
          <DashboardCard.Header>
            <DashboardCard.Title>
              <FormattedMessage
                {...(lines.length === 1 ? messages.itemReadyToShip : messages.itemsReadyToShip)}
              />
            </DashboardCard.Title>
          </DashboardCard.Header>
          {order ? (
            <Box className={styles.list} data-test-id="order-fulfill-lines">
              <Box className={styles.headerRow}>
                {[messages.productName, messages.sku, messages.quantity, messages.stock].map(
                  (message) => (
                    <Text
                      key={message.id}
                      size={2}
                      color="default2"
                      className={message === messages.stock ? styles.stock : undefined}
                    >
                      <FormattedMessage {...message} />
                    </Text>
                  ),
                )}
                <Text size={2} color="default2">
                  <FormattedMessage {...messages.warehouse} />
                </Text>
              </Box>
              {lines.map((line) => {
                const row = form.find((item) => item.lineId === line.id);
                const quantity = row?.quantity ?? 0;
                const available = getAvailableQuantity(line, row?.warehouse?.id);
                const thumbnail = line.variant?.product.thumbnail?.url;

                return (
                  <Box key={line.id} className={styles.row} data-test-id="order-fulfill-line">
                    <Box className={styles.product}>
                      {thumbnail ? (
                        <img className={styles.thumbnail} src={thumbnail} alt="" />
                      ) : (
                        <Box className={styles.thumbnail} />
                      )}
                      <Box display="flex" flexDirection="column" __minWidth={0}>
                        <Text size={3}>{line.productName}</Text>
                        {line.variantName && (
                          <Text size={2} color="default2">
                            {line.variantName}
                          </Text>
                        )}
                      </Box>
                    </Box>
                    <Text size={3}>{line.productSku ?? "-"}</Text>
                    <QuantityInput
                      value={quantity}
                      max={line.quantityToFulfill}
                      isError={quantity > line.quantityToFulfill || quantity < 0}
                      aria-label={intl.formatMessage(messages.quantity)}
                      data-test-id="quantity-input"
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        setQuantity(line.id, Number.isNaN(value) ? 0 : value);
                      }}
                    />
                    <Text size={3} className={styles.stock}>
                      {row?.warehouse ? (available ?? "-") : "-"}
                    </Text>
                    <Text size={3}>{row?.warehouse?.name ?? "-"}</Text>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <DashboardCard.Content>
              <Skeleton />
            </DashboardCard.Content>
          )}
        </DashboardCard>
        <Savebar>
          <Savebar.Spacer />
          <Savebar.CancelButton onClick={onCancel} />
          <Savebar.ConfirmButton
            transitionState={saveButtonBar}
            onClick={() => onSubmit(form)}
            disabled={!order || !canSubmitFulfillment(form, lines) || saveButtonBar === "loading"}
          >
            {intl.formatMessage(messages.submitFulfillment)}
          </Savebar.ConfirmButton>
        </Savebar>
      </DetailPageLayout.Content>
    </DetailPageLayout>
  );
};
