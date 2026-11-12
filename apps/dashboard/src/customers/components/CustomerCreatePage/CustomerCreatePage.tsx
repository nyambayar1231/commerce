// Adapted from saleor-dashboard: src/customers/components/CustomerCreatePage/CustomerCreatePage.tsx
// and CustomerCreateDetails/CustomerCreateDetails.tsx (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's "Create Customer" page: the "Customer Overview" card (first name, last name, email in a
// two-column grid) and the Savebar. Left out: the address and note cards (no address book or
// notes: PLAN M7 decisions 3–4).
import { Box, Input } from "@saleor/macaw-ui";
import type * as React from "react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { TopNavDestinationIcon } from "../../../components/AppLayout/TopNav/destinationIcons";
import { topNavDestinationMessages } from "../../../components/AppLayout/TopNav/destinationMessages";
import { DashboardCard } from "../../../components/Card";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import type { AccountErrorFragment } from "../../../graphql/types.generated";
import { commonMessages } from "../../../intl";
import { getAccountErrorMessage, getFormErrors } from "../../../utils/errors";
import { customerListPath } from "../../urls";

export interface CustomerCreatePageFormData {
  customerFirstName: string;
  customerLastName: string;
  email: string;
}

const initialForm: CustomerCreatePageFormData = {
  customerFirstName: "",
  customerLastName: "",
  email: "",
};

interface CustomerCreatePageProps {
  disabled: boolean;
  errors: AccountErrorFragment[];
  saveButtonBar: ConfirmButtonTransitionState;
  onSubmit: (data: CustomerCreatePageFormData) => Promise<unknown>;
}

export const CustomerCreatePage = ({
  disabled,
  errors,
  saveButtonBar,
  onSubmit,
}: CustomerCreatePageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const [data, setData] = useState(initialForm);
  const { setIsDirty, setIsSubmitting } = useExitFormDialog();
  const isDirty = Object.values(data).some((value) => value !== "");
  // The API reports names as `firstName`/`lastName`; Saleor's form names them customer*.
  const formErrors = getFormErrors(["firstName", "lastName", "email"], errors);

  useEffect(() => {
    setIsDirty(isDirty);
  });

  const change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    if (name in initialForm) {
      setData((current) => ({ ...current, [name]: value }));
    }
  };

  const submit = async () => {
    if (disabled || !isDirty) return;
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DetailPageLayout gridTemplateColumns={1}>
        <TopNav
          href={customerListPath}
          hrefIcon={<TopNavDestinationIcon.customers />}
          hrefTitle={intl.formatMessage(topNavDestinationMessages.allCustomers)}
          title={intl.formatMessage({
            id: "N76zUg",
            defaultMessage: "Create Customer",
            description: "page header",
          })}
        />
        <DetailPageLayout.Content>
          <DashboardCard>
            <DashboardCard.Header>
              <DashboardCard.Title>
                {intl.formatMessage({
                  id: "fjPWOA",
                  defaultMessage: "Customer Overview",
                  description: "header",
                })}
              </DashboardCard.Title>
            </DashboardCard.Header>
            <DashboardCard.Content>
              <Box display="grid" __gridTemplateColumns="1fr 1fr" columnGap={2} rowGap={3}>
                <Input
                  data-test-id="customer-first-name"
                  disabled={disabled}
                  error={!!formErrors.firstName}
                  aria-invalid={!!formErrors.firstName}
                  name="customerFirstName"
                  label={intl.formatMessage(commonMessages.firstName)}
                  helperText={getAccountErrorMessage(formErrors.firstName, intl)}
                  type="text"
                  value={data.customerFirstName}
                  onChange={change}
                  spellCheck={false}
                />
                <Input
                  data-test-id="customer-last-name"
                  disabled={disabled}
                  error={!!formErrors.lastName}
                  aria-invalid={!!formErrors.lastName}
                  name="customerLastName"
                  label={intl.formatMessage(commonMessages.lastName)}
                  helperText={getAccountErrorMessage(formErrors.lastName, intl)}
                  type="text"
                  value={data.customerLastName}
                  onChange={change}
                  spellCheck={false}
                />
                <Input
                  data-test-id="customer-email"
                  disabled={disabled}
                  error={!!formErrors.email}
                  aria-invalid={!!formErrors.email}
                  name="email"
                  label={intl.formatMessage(commonMessages.email)}
                  helperText={getAccountErrorMessage(formErrors.email, intl)}
                  type="email"
                  value={data.email}
                  onChange={change}
                  spellCheck={false}
                />
              </Box>
            </DashboardCard.Content>
          </DashboardCard>
          <Savebar>
            <Savebar.Spacer />
            <Savebar.CancelButton onClick={() => navigate(customerListPath)} />
            <Savebar.ConfirmButton
              transitionState={saveButtonBar}
              onClick={() => void submit()}
              disabled={disabled || !isDirty}
            />
          </Savebar>
        </DetailPageLayout.Content>
      </DetailPageLayout>
    </form>
  );
};
