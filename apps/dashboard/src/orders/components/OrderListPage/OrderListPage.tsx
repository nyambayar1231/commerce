// Adapted from saleor-dashboard: src/orders/components/OrderListPage/OrderListPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The header and card. Saleor shows "All orders" as the label of its filter-presets dropdown next
// to a hidden TopNav title; without presets we show that label as text. Then Saleor's card: the
// status filter and search, and the datagrid with its pagination, and Saleor's "Create order"
// button (M13.5). Left out: the help link, the GraphiQL/settings menu, limits,
// extensions and the search syntax tooltip.
import { Box, Button, Text } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { ListFilters } from "../../../components/AppLayout/ListFilters/ListFilters";
import { TopNav } from "../../../components/AppLayout/TopNav";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { sectionNames } from "../../../intl";
import { messages as draftMessages } from "../OrderDraftListPage/OrderDraftListPage";
import { OrderListDatagrid } from "../OrderListDatagrid/OrderListDatagrid";
import { messages } from "./messages";

interface OrderListPageProps extends ComponentProps<typeof OrderListDatagrid> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
  onAdd: () => void;
  creating: boolean;
}

export const OrderListPage = ({
  initialSearch,
  onSearchChange,
  onAdd,
  creating,
  ...listProps
}: OrderListPageProps) => {
  const intl = useIntl();

  return (
    <ListPageLayout>
      <TopNav title={intl.formatMessage(sectionNames.orders)} withoutBorder isAlignToRight={false}>
        <Box __flex={1} display="flex" justifyContent="space-between" alignItems="center">
          <Text size={6}>
            <FormattedMessage {...messages.allOrders} />
          </Text>
          <Button data-test-id="create-order-button" disabled={creating} onClick={onAdd}>
            <FormattedMessage {...draftMessages.createOrder} />
          </Button>
        </Box>
      </TopNav>
      <DashboardCard>
        <ListFilters
          initialSearch={initialSearch}
          searchPlaceholder={intl.formatMessage(messages.searchOrders)}
          onSearchChange={onSearchChange}
        />
        <OrderListDatagrid {...listProps} />
      </DashboardCard>
    </ListPageLayout>
  );
};
