// Adapted from saleor-dashboard: src/customers/components/CustomerListPage/CustomerListPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's header ("Customers") and card: the search and the datagrid. Not yet: the "Create
// customer" button and the bulk delete button (M7.5). Left out: the conditional filters (PLAN M7
// decision 3), customer-type tabs, the create-customer-type option and extensions.
import type { ComponentProps } from "react";
import { useIntl } from "react-intl";

import { ListFilters } from "../../../components/AppLayout/ListFilters/ListFilters";
import { TopNav } from "../../../components/AppLayout/TopNav";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { sectionNames } from "../../../intl";
import { CustomerListDatagrid } from "../CustomerListDatagrid/CustomerListDatagrid";

interface CustomerListPageProps
  extends Omit<ComponentProps<typeof CustomerListDatagrid>, "searchQuery"> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
}

export const CustomerListPage = ({
  initialSearch,
  onSearchChange,
  ...listProps
}: CustomerListPageProps) => {
  const intl = useIntl();

  return (
    <ListPageLayout>
      <TopNav title={intl.formatMessage(sectionNames.customers)} withoutBorder />
      <DashboardCard>
        <ListFilters
          withFilters={false}
          initialSearch={initialSearch}
          searchPlaceholder={intl.formatMessage({
            id: "bVjFta",
            defaultMessage: "Search customers",
          })}
          onSearchChange={onSearchChange}
        />
        <CustomerListDatagrid {...listProps} searchQuery={initialSearch} />
      </DashboardCard>
    </ListPageLayout>
  );
};
