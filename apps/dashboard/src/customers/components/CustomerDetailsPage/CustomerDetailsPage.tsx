// Adapted from saleor-dashboard: src/customers/components/CustomerDetailsPage/CustomerDetailsPage.tsx
// and CustomerSaveCompositionHint.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's customer page: TopNav (back to all customers, the title with status pills, the ⋯ menu
// with Activate/Deactivate and Delete user), the KPI overview and Recent Orders in the main column
// (both need MANAGE_ORDERS for the order figures), the Contact card in the sidebar, and the Savebar
// ("Unsaved changes: details", Back, Save). Staff without MANAGE_USERS see it read-only, as in
// Saleor. Left out: the metadata button and dialog, GraphiQL, the addresses card, customer type
// and attributes, external reference, gift cards and extension widgets (PLAN M7 decisions 3–4).

import { Box } from "@saleor/macaw-ui";
import { Trash2, UserCheck, UserX } from "lucide-react";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { TopNavDestinationIcon } from "../../../components/AppLayout/TopNav/destinationIcons";
import { topNavDestinationMessages } from "../../../components/AppLayout/TopNav/destinationMessages";
import type { TopNavMenuItem } from "../../../components/AppLayout/TopNav/Menu";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { DetailPageContent } from "../../../components/DetailPageContent/DetailPageContent";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import { SavebarCompositionHint } from "../../../components/Savebar/SavebarCompositionHint";
import type { AccountErrorFragment, CustomerDetailsQuery } from "../../../graphql/types.generated";
import { orderListUrl } from "../../../orders/urls";
import { customerListPath } from "../../urls";
import { CustomerInfo, type CustomerInfoData } from "../CustomerInfo/CustomerInfo";
import { CustomerOrders } from "../CustomerOrders/CustomerOrders";
import { CustomerOverview } from "../CustomerOverview/CustomerOverview";
import { messages } from "./messages";
import { CustomerDetailsTitle } from "./Title";

export type CustomerDetailsPageSubmitData = CustomerInfoData;

interface CustomerDetailsPageProps {
  customer: CustomerDetailsQuery["user"] | undefined;
  canEdit: boolean;
  canReadOrders: boolean;
  disabled: boolean;
  errors: AccountErrorFragment[];
  saveButtonBar: ConfirmButtonTransitionState;
  onSubmit: (data: CustomerDetailsPageSubmitData) => Promise<unknown>;
  onDelete: () => void;
  onActivateToggle: () => void;
}

const initialData = (customer: CustomerDetailsQuery["user"] | undefined): CustomerInfoData => ({
  firstName: customer?.firstName ?? "",
  lastName: customer?.lastName ?? "",
  email: customer?.email ?? "",
});

/** True when the form differs from the saved customer (Saleor's save composition "details"). */
export const hasCustomerChanges = (data: CustomerInfoData, initial: CustomerInfoData): boolean =>
  data.firstName !== initial.firstName ||
  data.lastName !== initial.lastName ||
  data.email !== initial.email;

export const CustomerDetailsPage = ({
  customer,
  canEdit,
  canReadOrders,
  disabled,
  errors,
  saveButtonBar,
  onSubmit,
  onDelete,
  onActivateToggle,
}: CustomerDetailsPageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const initial = useMemo(() => initialData(customer), [customer]);
  const [data, setData] = useState(initial);
  const { setIsDirty, setIsSubmitting } = useExitFormDialog();

  useEffect(() => {
    setData(initial);
  }, [initial]);

  const hasChanges = hasCustomerChanges(data, initial);
  const isSaveDisabled = disabled || !canEdit || !hasChanges;

  useEffect(() => {
    setIsDirty(canEdit && hasChanges);
  });

  const change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    if (name === "firstName" || name === "lastName" || name === "email") {
      setData((current) => ({ ...current, [name]: value }));
    }
  };

  const submit = async () => {
    if (isSaveDisabled) return;
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const menuItems = useMemo((): TopNavMenuItem[] => {
    if (!customer || !canEdit) {
      return [];
    }

    return [
      customer.isActive
        ? {
            label: intl.formatMessage(messages.deactivateUser),
            onSelect: onActivateToggle,
            testId: "deactivate-user",
            icon: <UserX size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
          }
        : {
            label: intl.formatMessage(messages.activateUser),
            onSelect: onActivateToggle,
            testId: "activate-user",
            icon: <UserCheck size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
          },
      {
        label: intl.formatMessage(messages.deleteUser),
        onSelect: onDelete,
        testId: "delete-user",
        color: "critical1",
        icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
      },
    ];
  }, [canEdit, customer, intl, onActivateToggle, onDelete]);

  const orders = customer?.orders?.edges.map((edge) => edge.node);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DetailPageLayout>
        <TopNav
          href={customerListPath}
          hrefIcon={<TopNavDestinationIcon.customers />}
          hrefTitle={intl.formatMessage(topNavDestinationMessages.allCustomers)}
          title={customer ? <CustomerDetailsTitle customer={customer} /> : "..."}
          actionsGap={3}
        >
          {menuItems.length > 0 && (
            <TopNav.Menu
              items={disabled ? menuItems.map((item) => ({ ...item, disabled: true })) : menuItems}
              dataTestId="menu"
            />
          )}
        </TopNav>
        <DetailPageLayout.Content>
          <DetailPageContent>
            <CustomerOverview customer={customer} canReadOrders={canReadOrders} />
            {canReadOrders && (
              <CustomerOrders
                orders={customer ? orders : undefined}
                viewAllHref={orderListUrl({ query: customer?.email })}
              />
            )}
          </DetailPageContent>
        </DetailPageLayout.Content>
        <DetailPageLayout.RightSidebar paddingTop={6} paddingX={6}>
          <Box display="flex" flexDirection="column" gap={4}>
            <CustomerInfo
              data={data}
              disabled={disabled || !canEdit}
              errors={errors}
              onChange={change}
            />
          </Box>
        </DetailPageLayout.RightSidebar>
        <Savebar>
          {canEdit ? (
            <>
              <Savebar.Spacer />
              {hasChanges && (
                <SavebarCompositionHint
                  segments={[intl.formatMessage(messages.saveCompositionGeneral)]}
                  data-test-id="customer-save-composition"
                />
              )}
              <Savebar.CancelButton onClick={() => navigate(customerListPath)} />
              <Savebar.ConfirmButton
                transitionState={saveButtonBar}
                onClick={() => void submit()}
                disabled={isSaveDisabled}
              />
            </>
          ) : (
            <Savebar.ReadOnlyLabel />
          )}
        </Savebar>
      </DetailPageLayout>
    </form>
  );
};
