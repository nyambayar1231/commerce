// Adapted from saleor-dashboard: src/customers/components/CustomerOrders/CustomerOrders.tsx and
// src/components/AssignableListTable/AssignableListCard.tsx (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Recent Orders": the customer's last orders (number, date, status pill, total), each row a link
// to the order, and "View all orders" opening the order list searched by the customer's email
// (Saleor filters it by the customer; our order list searches emails). A plain table stands in
// for Saleor's AssignableListTable (no selection or paging here); the channel column is left out.
import { Box, Button, Text } from "@saleor/macaw-ui";
import { ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";

import { DashboardCard } from "../../../components/Card";
import { Pill } from "../../../components/Pill/Pill";
import type { CustomerDetailsQuery } from "../../../graphql/types.generated";
import { transformOrderStatus } from "../../../misc";
import { orderUrl } from "../../../orders/urls";
import { messages } from "./messages";

export type CustomerRecentOrder = NonNullable<
  NonNullable<CustomerDetailsQuery["user"]>["orders"]
>["edges"][number]["node"];

interface CustomerOrdersProps {
  orders: CustomerRecentOrder[] | undefined;
  viewAllHref: string;
}

const COLUMNS = "16% 30% 30% 24%";

const Cell = ({ children, align }: { children: ReactNode; align?: "end" }) => (
  <Box
    display="flex"
    alignItems="center"
    justifyContent={align === "end" ? "flex-end" : "flex-start"}
    paddingY={3}
    paddingX={2}
    overflow="hidden"
  >
    {children}
  </Box>
);

export const CustomerOrders = ({ orders, viewAllHref }: CustomerOrdersProps) => {
  const intl = useIntl();

  return (
    <DashboardCard data-test-id="customer-orders">
      <DashboardCard.Header>
        <DashboardCard.Title>
          <FormattedMessage {...messages.title} />
        </DashboardCard.Title>
        <DashboardCard.Toolbar>
          {orders === undefined ? (
            <Button variant="secondary" disabled>
              <FormattedMessage {...messages.viewAll} />
            </Button>
          ) : (
            <Link to={viewAllHref}>
              <Button variant="secondary" type="button">
                <FormattedMessage {...messages.viewAll} />
              </Button>
            </Link>
          )}
        </DashboardCard.Toolbar>
      </DashboardCard.Header>
      <DashboardCard.Content>
        {orders && orders.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            paddingY={6}
            color="default2"
            data-test-id="customer-orders-empty"
          >
            <ShoppingCart size={24} aria-hidden />
            <Text size={2} color="default2">
              <FormattedMessage {...messages.empty} />
            </Text>
          </Box>
        ) : (
          <Box role="table" data-test-id="customer-orders-table">
            <Box role="row" display="grid" __gridTemplateColumns={COLUMNS}>
              {[
                messages.orderColumn,
                messages.dateColumn,
                messages.statusColumn,
                messages.totalColumn,
              ].map((message, index) => (
                <Cell key={message.id} align={index === 3 ? "end" : undefined}>
                  <Text size={2} color="default2" fontWeight="medium">
                    <FormattedMessage {...message} />
                  </Text>
                </Cell>
              ))}
            </Box>
            {(orders ?? []).map((order) => {
              const status = transformOrderStatus(order.status, intl);

              return (
                <Link
                  key={order.id}
                  to={orderUrl(order.id)}
                  style={{ color: "inherit", textDecoration: "none" }}
                  data-test-id="customer-order-row"
                  aria-label={`#${order.number}`}
                >
                  <Box
                    role="row"
                    display="grid"
                    __gridTemplateColumns={COLUMNS}
                    borderTopStyle="solid"
                    borderTopWidth={1}
                    borderColor="default1"
                    backgroundColor={{ hover: "default1Hovered" }}
                  >
                    <Cell>
                      <Text size={2}>#{order.number}</Text>
                    </Cell>
                    <Cell>
                      <Text size={2}>
                        {typeof order.created === "string"
                          ? intl.formatDate(order.created, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : ""}
                      </Text>
                    </Cell>
                    <Cell>
                      <Pill
                        label={status.localized}
                        color={status.status}
                        data-test-id="customer-order-status"
                      />
                    </Cell>
                    <Cell align="end">
                      <Text size={2}>
                        {intl.formatNumber(order.total.gross.amount, {
                          style: "currency",
                          currency: order.total.gross.currency,
                          // MNT has no minor unit (ADR-0013); Intl would print two decimals.
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </Text>
                    </Cell>
                  </Box>
                </Link>
              );
            })}
          </Box>
        )}
      </DashboardCard.Content>
    </DashboardCard>
  );
};
