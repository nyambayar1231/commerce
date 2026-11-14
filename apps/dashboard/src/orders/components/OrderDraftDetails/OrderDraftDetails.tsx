// Adapted from saleor-dashboard: src/orders/components/OrderDraftDetails/OrderDraftDetails.tsx,
// OrderDraftDetailsProducts/OrderDraftDetailsProducts.tsx and OrderDraftDetailsDatagrid/
// (datagrid.ts, messages.ts) (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Order lines" with "Add products", then the draft's lines with Saleor's columns: product (with
// thumbnail), SKU, variant, quantity (editable), price and total, and a remove button. Saleor's
// grid edits the quantity in a Glide cell and removes from a row menu; our Datagrid has no cell
// editing yet, so this is a plain table like the Fulfill page's, with a number input that saves on
// blur or Enter. Left out: "is gift", status, discounts and metadata columns and actions.
import { Box, Button, Input, Skeleton, Text } from "@saleor/macaw-ui";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import { DashboardCard } from "../../../components/Card";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import { Placeholder } from "../../../components/Placeholder/Placeholder";
import type { OrderLineFragment } from "../../../graphql/types.generated";
import styles from "../OrderFulfillPage/OrderFulfillPage.module.css";
import draftStyles from "./OrderDraftDetails.module.css";

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
  product: { id: "x/ZVlU", defaultMessage: "Product" },
  quantity: { id: "nEWp+k", defaultMessage: "Quantity" },
  variant: { id: "OK5+Fh", defaultMessage: "Variant" },
  price: { id: "32dfzI", defaultMessage: "Price" },
  total: { id: "lVwmf5", defaultMessage: "Total" },
  emptyText: { id: "Q1Uzbb", defaultMessage: "No products found" },
  removeProduct: { id: "LKD6fB", defaultMessage: "Remove product" },
});

/** A quantity input that keeps its own text and saves a valid change on blur (Enter blurs). */
const LineQuantity = ({
  line,
  disabled,
  onChange,
}: {
  line: OrderLineFragment;
  disabled: boolean;
  onChange: (lineId: string, quantity: number) => void;
}) => {
  const intl = useIntl();
  const [value, setValue] = useState(String(line.quantity));

  useEffect(() => setValue(String(line.quantity)), [line.quantity]);

  const commit = () => {
    const quantity = Number.parseInt(value, 10);

    if (Number.isNaN(quantity) || quantity === line.quantity) {
      setValue(String(line.quantity));
      return;
    }
    onChange(line.id, quantity);
  };

  return (
    <Input
      type="number"
      size="small"
      value={value}
      disabled={disabled}
      aria-label={intl.formatMessage(messages.quantity)}
      data-test-id="line-quantity-input"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        // Enter leaves the field; blur is the one place that saves (no double save).
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
};

interface OrderDraftDetailsProps {
  lines?: OrderLineFragment[];
  disabled: boolean;
  /** Finalize's errors about the lines (no products, stock, unpublished), shown in red. */
  errors?: string[];
  onOrderLineAdd: () => void;
  onOrderLineChange: (lineId: string, quantity: number) => void;
  onOrderLineRemove: (lineId: string) => void;
}

export const OrderDraftDetails = ({
  lines,
  disabled,
  errors = [],
  onOrderLineAdd,
  onOrderLineChange,
  onOrderLineRemove,
}: OrderDraftDetailsProps) => {
  const intl = useIntl();
  const money = (amount: number) => intl.formatNumber(amount, { maximumFractionDigits: 0 });

  return (
    <DashboardCard gap={0} data-test-id="draft-order-lines">
      <DashboardCard.Header>
        <DashboardCard.Title>
          <FormattedMessage {...messages.title} />
        </DashboardCard.Title>
        <DashboardCard.Toolbar>
          <Button
            variant="secondary"
            onClick={onOrderLineAdd}
            disabled={disabled}
            data-test-id="add-products-button"
          >
            <FormattedMessage {...messages.addProducts} />
          </Button>
        </DashboardCard.Toolbar>
      </DashboardCard.Header>
      {errors.length > 0 && (
        <DashboardCard.Content paddingBottom={2} data-test-id="lines-errors">
          {errors.map((error) => (
            <Text key={error} color="critical1" size={3} display="block">
              {error}
            </Text>
          ))}
        </DashboardCard.Content>
      )}
      {lines === undefined ? (
        <DashboardCard.Content>
          <Skeleton />
        </DashboardCard.Content>
      ) : lines.length === 0 ? (
        <DashboardCard.Content paddingBottom={6}>
          <Placeholder>
            <FormattedMessage {...messages.emptyText} />
          </Placeholder>
        </DashboardCard.Content>
      ) : (
        <Box className={styles.list} paddingTop={4}>
          <Box className={`${styles.headerRow} ${draftStyles.columns}`}>
            {[messages.product, null, messages.variant, messages.quantity, messages.price].map(
              (message) => (
                <Text key={message?.id ?? "sku"} size={2} color="default2">
                  {message ? <FormattedMessage {...message} /> : "SKU"}
                </Text>
              ),
            )}
            <Text size={2} color="default2" className={draftStyles.number}>
              <FormattedMessage {...messages.total} />
            </Text>
            <span />
          </Box>
          {lines.map((line) => {
            const thumbnail = line.variant?.product.thumbnail?.url;

            return (
              <Box
                key={line.id}
                className={`${styles.row} ${draftStyles.columns}`}
                data-test-id="draft-order-line"
              >
                <Box className={styles.product}>
                  {thumbnail ? (
                    <img className={styles.thumbnail} src={thumbnail} alt="" />
                  ) : (
                    <Box className={styles.thumbnail} />
                  )}
                  <Text size={3}>{line.productName}</Text>
                </Box>
                <Text size={3} className={draftStyles.wrap}>
                  {line.productSku || "-"}
                </Text>
                <Text size={3} className={draftStyles.wrap}>
                  {line.variantName || "-"}
                </Text>
                <LineQuantity line={line} disabled={disabled} onChange={onOrderLineChange} />
                <Text size={3} className={draftStyles.number}>
                  {money(line.unitPrice.gross.amount)}
                </Text>
                <Text size={3} className={draftStyles.number}>
                  {money(line.totalPrice.gross.amount)}
                </Text>
                <Button
                  type="button"
                  variant="tertiary"
                  disabled={disabled}
                  title={intl.formatMessage(messages.removeProduct)}
                  aria-label={intl.formatMessage(messages.removeProduct)}
                  data-test-id="remove-line-button"
                  icon={<Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />}
                  onClick={() => onOrderLineRemove(line.id)}
                />
              </Box>
            );
          })}
        </Box>
      )}
    </DashboardCard>
  );
};
