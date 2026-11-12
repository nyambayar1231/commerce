// Adapted from saleor-dashboard: src/customers/components/CustomerListPage/CustomerListPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's header ("Customers" and the "Create customer" button) and card: the search, the bulk
// delete button for the selected rows, and the datagrid. Creating and deleting need MANAGE_USERS,
// as in Saleor. Left out: the conditional filters (PLAN M7 decision 3), customer-type tabs, the
// create-customer-type option and extensions.
import { Button } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { ListFilters } from "../../../components/AppLayout/ListFilters/ListFilters";
import { TopNav } from "../../../components/AppLayout/TopNav";
import { BulkDeleteButton } from "../../../components/BulkDeleteButton/BulkDeleteButton";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { sectionNames } from "../../../intl";
import { CustomerListDatagrid } from "../CustomerListDatagrid/CustomerListDatagrid";

interface CustomerListPageProps
  extends Omit<ComponentProps<typeof CustomerListDatagrid>, "searchQuery"> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
  canEdit: boolean;
  selectedCustomerIds: string[];
  onAdd: () => void;
  onCustomersDelete: () => void;
}

export const CustomerListPage = ({
  initialSearch,
  onSearchChange,
  canEdit,
  selectedCustomerIds,
  onAdd,
  onCustomersDelete,
  ...listProps
}: CustomerListPageProps) => {
  const intl = useIntl();

  return (
    <ListPageLayout>
      <TopNav title={intl.formatMessage(sectionNames.customers)} withoutBorder>
        {canEdit && (
          <Button data-test-id="create-customer" onClick={onAdd}>
            <FormattedMessage id="QLVddq" defaultMessage="Create customer" description="button" />
          </Button>
        )}
      </TopNav>
      <DashboardCard>
        <ListFilters
          withFilters={false}
          initialSearch={initialSearch}
          searchPlaceholder={intl.formatMessage({
            id: "bVjFta",
            defaultMessage: "Search customers",
          })}
          onSearchChange={onSearchChange}
          actions={
            canEdit &&
            selectedCustomerIds.length > 0 && (
              <BulkDeleteButton count={selectedCustomerIds.length} onClick={onCustomersDelete}>
                <FormattedMessage defaultMessage="Delete customers" id="kFsTMN" />
              </BulkDeleteButton>
            )
          }
        />
        <CustomerListDatagrid {...listProps} searchQuery={initialSearch} />
      </DashboardCard>
    </ListPageLayout>
  );
};
