// Adapted from saleor-dashboard: src/customers/components/CustomerOverview/CustomerOverview.tsx and
// CustomerOverviewMoneyBreakdownTooltip.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's KPI tiles above the customer page: total orders (not cancelled) with the last order
// date, recent total and average order value over the last 10 orders (products only; shipping and
// refunds in the value's tooltip), and the last login. The order tiles need MANAGE_ORDERS, as in
// Saleor. With one channel there is no channel picker, and the "{count} of last {n} orders in
// {channel}" subtitle (which names the channel) is left out.
import { Box, Text } from "@saleor/macaw-ui";
import { Banknote, LogIn, Receipt, ShoppingCart } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { KpiCard } from "../../../components/KpiCard/KpiCard";
import type { CustomerDetailsQuery } from "../../../graphql/types.generated";
import styles from "./CustomerOverview.module.css";
import {
  buildCustomerOrderKpiMetrics,
  formatMoneyAmount,
  RECENT_ORDERS_WINDOW,
  selectRecentOrdersForKpis,
} from "./utils";

type Customer = NonNullable<CustomerDetailsQuery["user"]>;

interface CustomerOverviewProps {
  customer: Customer | null | undefined;
  canReadOrders: boolean;
}

interface Money {
  amount: number;
  currency: string;
}

const ICON_SIZE = 16;
const EMPTY_VALUE = "—";

const MoneyValue = ({ money, locale }: { money: Money; locale: string }) => (
  <>
    {formatMoneyAmount(money, locale)}
    <Text as="span" size={2} color="default2" fontWeight="medium" paddingLeft={1.5}>
      {money.currency}
    </Text>
  </>
);

const MoneyTooltipRow = ({
  label,
  money,
  locale,
}: {
  label: ReactNode;
  money: Money;
  locale: string;
}) => (
  <Box className={styles.moneyTooltipRow}>
    <Text size={2} color="default2" className={styles.moneyTooltipLabel}>
      {label}
    </Text>
    <Text size={2} fontWeight="medium" color="default1" className={styles.moneyTooltipValue}>
      {formatMoneyAmount(money, locale)}
      <Text as="span" size={2} color="default2" fontWeight="regular" paddingLeft={1}>
        {money.currency}
      </Text>
    </Text>
  </Box>
);

const MoneyBreakdownTooltip = ({
  shipping,
  refunded,
  locale,
}: {
  shipping?: Money;
  refunded?: Money;
  locale: string;
}) => (
  <Box className={styles.moneyTooltip}>
    <Text size={2} color="default2">
      <FormattedMessage
        defaultMessage="From these orders"
        description="customer overview, value tooltip heading for shipping and refund breakdown"
        id="mKu838"
      />
    </Text>
    <Box display="flex" flexDirection="column" gap={1.5}>
      {shipping && shipping.amount > 0 && (
        <MoneyTooltipRow
          label={
            <FormattedMessage
              defaultMessage="Shipping"
              description="customer overview, shipping row label in value tooltip"
              id="qXjR1X"
            />
          }
          money={shipping}
          locale={locale}
        />
      )}
      {refunded && refunded.amount > 0 && (
        <MoneyTooltipRow
          label={
            <FormattedMessage
              defaultMessage="Refunded"
              description="customer overview, refunded row label in value tooltip"
              id="mMEpFC"
            />
          }
          money={refunded}
          locale={locale}
        />
      )}
    </Box>
  </Box>
);

export const CustomerOverview = ({ customer, canReadOrders }: CustomerOverviewProps) => {
  const intl = useIntl();
  const locale = intl.locale;
  const loading = !customer;
  const kpiOrders = useMemo(
    () => customer?.kpiOrders?.edges.map((edge) => edge.node) ?? [],
    [customer?.kpiOrders],
  );
  const recentOrders = useMemo(() => selectRecentOrdersForKpis(kpiOrders), [kpiOrders]);
  const metrics = useMemo(() => buildCustomerOrderKpiMetrics(kpiOrders), [kpiOrders]);
  const totalOrders = customer?.kpiNonCancelledOrderCount?.totalCount;
  const lastOrder = recentOrders[0];

  const formatDate = (value: unknown) =>
    typeof value === "string" ? intl.formatDate(value, { dateStyle: "medium" }) : "";

  const netSalesTooltip = (() => {
    if (!metrics) return undefined;
    const hasShipping = metrics.shippingTotal.amount > 0;
    const hasRefunds = metrics.refundedTotal.amount > 0;
    if (!hasShipping && !hasRefunds) return undefined;

    return (
      <MoneyBreakdownTooltip
        locale={locale}
        shipping={hasShipping ? metrics.shippingTotal : undefined}
        refunded={hasRefunds ? metrics.refundedTotal : undefined}
      />
    );
  })();

  const lastLogin = typeof customer?.lastLogin === "string" ? customer.lastLogin : null;

  return (
    <Box data-test-id="customer-overview" display="flex" flexDirection="column" gap={4}>
      <div className={styles.grid}>
        {canReadOrders && (
          <>
            <KpiCard
              dataTestId="kpi-total-orders"
              icon={<ShoppingCart size={ICON_SIZE} />}
              title={
                <FormattedMessage
                  defaultMessage="Total orders"
                  description="customer overview stat label"
                  id="HRy5qF"
                />
              }
              tooltip={
                <FormattedMessage
                  defaultMessage="Number of orders placed by this customer in the selected channel. Draft and cancelled orders are not counted."
                  description="customer overview, total orders tooltip"
                  id="xwXFUB"
                />
              }
              value={loading ? EMPTY_VALUE : (totalOrders ?? 0)}
              subtitle={
                lastOrder ? (
                  <FormattedMessage
                    defaultMessage="Last order: {date}"
                    description="customer overview, subtitle on total orders showing the most recent order date"
                    id="PyxGqS"
                    values={{ date: formatDate(lastOrder.created) }}
                  />
                ) : undefined
              }
              loading={loading}
            />
            <KpiCard
              dataTestId="kpi-recent-spent"
              icon={<Banknote size={ICON_SIZE} />}
              title={
                <FormattedMessage
                  defaultMessage="Recent total"
                  description="customer overview stat label: sum of recent orders net product sales"
                  id="5Nv7ig"
                />
              }
              tooltip={
                <FormattedMessage
                  defaultMessage="Sum of product revenue from this customer's last {windowSize} orders in this channel. Excludes shipping and tax. Discounts are already applied."
                  description="customer overview, recent net sales tooltip"
                  id="tQA//+"
                  values={{ windowSize: metrics?.windowSize ?? RECENT_ORDERS_WINDOW }}
                />
              }
              value={
                metrics ? <MoneyValue money={metrics.netSales} locale={locale} /> : EMPTY_VALUE
              }
              valueTooltip={netSalesTooltip}
              loading={loading}
            />
            <KpiCard
              dataTestId="kpi-recent-aov"
              icon={<Receipt size={ICON_SIZE} />}
              title={
                <FormattedMessage
                  defaultMessage="Avg order value"
                  description="customer overview stat label: average order value of recent orders"
                  id="aTe9zV"
                />
              }
              tooltip={
                <FormattedMessage
                  defaultMessage="Average product revenue per order in this channel, from the last {windowSize} orders. Excludes shipping and tax."
                  description="customer overview, AOV tooltip"
                  id="bIttOt"
                  values={{ windowSize: metrics?.windowSize ?? RECENT_ORDERS_WINDOW }}
                />
              }
              value={metrics ? <MoneyValue money={metrics.aov} locale={locale} /> : EMPTY_VALUE}
              loading={loading}
            />
          </>
        )}
        <KpiCard
          dataTestId="kpi-last-login"
          icon={<LogIn size={ICON_SIZE} />}
          title={
            <FormattedMessage
              defaultMessage="Last login"
              description="customer overview stat label"
              id="aYnI0N"
            />
          }
          tooltip={
            <FormattedMessage
              defaultMessage="Most recent time this customer signed in to their account."
              description="customer overview, last login tooltip"
              id="n8tEIV"
            />
          }
          value={lastLogin ? formatDate(lastLogin) : EMPTY_VALUE}
          subtitle={
            lastLogin ? intl.formatTime(lastLogin, { timeZoneName: "shortOffset" }) : undefined
          }
          loading={loading}
        />
      </div>
    </Box>
  );
};
