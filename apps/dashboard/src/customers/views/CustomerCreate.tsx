// Adapted from saleor-dashboard: src/customers/views/CustomerCreate.tsx (BSD-3-Clause, Copyright
// (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Creates the customer, toasts "Customer created" and opens their page, as Saleor. Left out: the
// default address, note and customer type (PLAN M7 decisions 3–4), and the window title.
import { useMutation } from "@apollo/client";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import { CreateCustomerDocument } from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import {
  CustomerCreatePage,
  type CustomerCreatePageFormData,
} from "../components/CustomerCreatePage/CustomerCreatePage";
import { customerUrl } from "../urls";

export const CustomerCreate = () => {
  const navigate = useNavigate();
  const intl = useIntl();
  const notify = useNotifier();
  const [createCustomer, createCustomerOpts] = useMutation(CreateCustomerDocument, {
    onCompleted: (result) => {
      const payload = result.customerCreate;

      if (payload && payload.errors.length === 0 && payload.user) {
        notify({
          status: "success",
          text: intl.formatMessage({ id: "ftcHpD", defaultMessage: "Customer created" }),
        });
        navigate(customerUrl(payload.user.id));
      }
    },
  });

  const handleSubmit = (formData: CustomerCreatePageFormData) =>
    createCustomer({
      variables: {
        input: {
          email: formData.email,
          firstName: formData.customerFirstName,
          lastName: formData.customerLastName,
        },
      },
    });

  return (
    <CustomerCreatePage
      disabled={createCustomerOpts.loading}
      errors={createCustomerOpts.data?.customerCreate?.errors ?? []}
      saveButtonBar={getMutationStatus({
        ...createCustomerOpts,
        errors: createCustomerOpts.data?.customerCreate?.errors,
      })}
      onSubmit={handleSubmit}
    />
  );
};
