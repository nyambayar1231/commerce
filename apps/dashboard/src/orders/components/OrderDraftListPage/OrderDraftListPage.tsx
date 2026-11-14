// Adapted from saleor-dashboard: src/orders/components/OrderDraftListPage/OrderDraftListPage.tsx
// and OrderDraftListHeader/OrderDraftListHeader.tsx (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Drafts": Saleor's header ("All draft orders" is its filter-presets label, shown as text as on
// our order list) with the "Create order" button, then the search and the grid. Left out: filter
// presets, bulk delete, limits, extensions and the search syntax tooltip.
import { Box, Button, Text } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import { ListFilters } from "../../../components/AppLayout/ListFilters/ListFilters";
import { TopNav } from "../../../components/AppLayout/TopNav";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { sectionNames } from "../../../intl";
import { OrderDraftListDatagrid } from "../OrderDraftListDatagrid/OrderDraftListDatagrid";

export const messages = defineMessages({
  allDraftOrders: {
    id: "nJ0tek",
    defaultMessage: "All draft orders",
    description: "tab name",
  },
  searchDraftOrders: {
    id: "IzECoP",
    defaultMessage: "Search draft orders...",
  },
  createOrder: {
    id: "LshEVn",
    defaultMessage: "Create order",
    description: "button",
  },
});

interface OrderDraftListPageProps extends ComponentProps<typeof OrderDraftListDatagrid> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
  onAdd: () => void;
  creating: boolean;
}

export const OrderDraftListPage = ({
  initialSearch,
  onSearchChange,
  onAdd,
  creating,
  ...listProps
}: OrderDraftListPageProps) => {
  const intl = useIntl();

  return (
    <ListPageLayout>
      <TopNav
        title={intl.formatMessage(sectionNames.draftOrders)}
        withoutBorder
        isAlignToRight={false}
      >
        <Box __flex={1} display="flex" justifyContent="space-between" alignItems="center">
          <Text size={6}>
            <FormattedMessage {...messages.allDraftOrders} />
          </Text>
          <Button data-test-id="create-draft-order-button" disabled={creating} onClick={onAdd}>
            <FormattedMessage {...messages.createOrder} />
          </Button>
        </Box>
      </TopNav>
      <DashboardCard>
        <ListFilters
          initialSearch={initialSearch}
          searchPlaceholder={intl.formatMessage(messages.searchDraftOrders)}
          onSearchChange={onSearchChange}
          withFilters={false}
        />
        <OrderDraftListDatagrid {...listProps} />
      </DashboardCard>
    </ListPageLayout>
  );
};
