// Adapted from saleor-dashboard: src/customers/components/CustomerOverview/utils.ts and
// constants.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's KPI arithmetic over the customer's recent orders, without the channel helpers (one
// channel). Net sales and the average use `subtotal.net` (products after discounts, no tax or
// shipping); shipping and refunds are summed for the value's tooltip.

/** Number of placed orders used for recent net sales and AOV (excludes draft and cancelled). */
export const RECENT_ORDERS_WINDOW = 10;

interface Money {
  amount: number;
  currency: string;
}

export interface CustomerOrderForKpi {
  status: string;
  created: unknown;
  subtotal: { net: Money };
  shippingPrice: { gross: Money };
  totalRefunded: Money;
}

export interface CustomerOrderKpiMetrics {
  windowSize: number;
  orderCount: number;
  currency: string;
  netSales: Money;
  aov: Money;
  shippingTotal: Money;
  refundedTotal: Money;
}

const createdTime = (created: unknown): number =>
  typeof created === "string" ? new Date(created).getTime() : 0;

export const isExcludedFromCustomerOrderKpis = (status: string): boolean =>
  status === "CANCELED" || status === "CANCELLED" || status === "DRAFT";

export const selectRecentOrdersForKpis = <T extends { status: string; created: unknown }>(
  orders: ReadonlyArray<T>,
  windowSize = RECENT_ORDERS_WINDOW,
): T[] =>
  [...orders]
    .filter((order) => !isExcludedFromCustomerOrderKpis(order.status))
    .sort((a, b) => createdTime(b.created) - createdTime(a.created))
    .slice(0, windowSize);

const sumMoney = (
  orders: ReadonlyArray<CustomerOrderForKpi>,
  getAmount: (order: CustomerOrderForKpi) => number,
  currency: string,
): Money => ({
  amount: orders.reduce((sum, order) => sum + getAmount(order), 0),
  currency,
});

/** Saleor's buildCustomerOrderKpiMetrics: null when no order counts. */
export const buildCustomerOrderKpiMetrics = (
  orders: ReadonlyArray<CustomerOrderForKpi>,
  windowSize = RECENT_ORDERS_WINDOW,
): CustomerOrderKpiMetrics | null => {
  const recentOrders = selectRecentOrdersForKpis(orders, windowSize);
  const first = recentOrders[0];

  if (!first) {
    return null;
  }

  const currency = first.subtotal.net.currency;
  const netSalesAmount = recentOrders.reduce((sum, order) => sum + order.subtotal.net.amount, 0);

  return {
    windowSize: recentOrders.length,
    orderCount: recentOrders.length,
    currency,
    netSales: { amount: netSalesAmount, currency },
    aov: { amount: netSalesAmount / recentOrders.length, currency },
    shippingTotal: sumMoney(recentOrders, (order) => order.shippingPrice.gross.amount, currency),
    refundedTotal: sumMoney(recentOrders, (order) => order.totalRefunded.amount, currency),
  };
};

/**
 * Saleor's formatMoneyAmount: the amount without the currency. Our shop's currency, MNT, has no
 * minor unit (ADR-0013) although Intl gives it two decimals, so amounts are whole numbers, as in
 * the rest of the dashboard; an average is rounded.
 */
export const formatMoneyAmount = (money: Money, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(money.amount);
