// Adapted from saleor-dashboard: src/customers/views/CustomerDetails.tsx (BSD-3-Clause, Copyright
// (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Loads the customer named by the URL and runs the page's actions. The open dialog lives in the
// URL as Saleor's (`action=remove|activate|deactivate`); saving, activating and deactivating are
// `customerUpdate` with Saleor's toasts, deleting is `customerDelete` and returns to the list.
// Staff without MANAGE_USERS see the page read-only; the order figures need MANAGE_ORDERS. An
// unknown id (or a user outside the staff member's scope) is not found. Left out: metadata,
// customer types, attributes, reference searches and the window title.
import { useMutation, useQuery } from "@apollo/client";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { useUser } from "../../auth/AuthProvider";
import { hasPermission } from "../../auth/misc";
import { getMutationStatus } from "../../categories/mutationStatus";
import {
  CustomerDetailsDocument,
  RemoveCustomerDocument,
  UpdateCustomerDocument,
} from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../NotFound";
import { CustomerDeleteDialog } from "../components/CustomerDeleteDialog/CustomerDeleteDialog";
import {
  CustomerDetailsPage,
  type CustomerDetailsPageSubmitData,
} from "../components/CustomerDetailsPage/CustomerDetailsPage";
import { CustomerStatusChangeDialog } from "../components/CustomerStatusChangeDialog/CustomerStatusChangeDialog";
import { customerListUrl, customerUrl, parseCustomerUrl } from "../urls";

export const CustomerDetails = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const params = parseCustomerUrl(searchParams);
  const navigate = useNavigate();
  const intl = useIntl();
  const notify = useNotifier();
  const { user: staff } = useUser();
  const canEdit = !!staff && hasPermission("MANAGE_USERS", staff);
  const canReadOrders = !!staff && hasPermission("MANAGE_ORDERS", staff);

  const { data, loading } = useQuery(CustomerDetailsDocument, {
    variables: { id, PERMISSION_MANAGE_ORDERS: canReadOrders },
  });
  const customer = data?.user;

  const [updateCustomer, updateCustomerOpts] = useMutation(UpdateCustomerDocument);
  const [removeCustomer, removeCustomerOpts] = useMutation(RemoveCustomerDocument, {
    onCompleted: (result) => {
      if ((result.customerDelete?.errors.length ?? 0) > 0) {
        for (const error of result.customerDelete?.errors ?? []) {
          notify({ status: "error", text: error.message ?? "" });
        }
        return;
      }
      notify({
        status: "success",
        text: intl.formatMessage({ id: "PXatmC", defaultMessage: "Customer Removed" }),
      });
      navigate(customerListUrl());
    },
  });

  const closeDialog = () => navigate(customerUrl(id), { replace: true });

  if (!loading && customer === null) {
    return <NotFound />;
  }

  const handleSubmit = async (formData: CustomerDetailsPageSubmitData) => {
    const result = await updateCustomer({
      variables: {
        id,
        input: {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
        },
      },
    });
    const errors = result.data?.customerUpdate?.errors ?? [];
    if (errors.length === 0) {
      notify({
        status: "success",
        text: intl.formatMessage({ id: "PeEood", defaultMessage: "Customer updated" }),
      });
    }
    return errors;
  };

  // Activating and deactivating go through a confirmation dialog, as Saleor's.
  const handleStatusConfirm = async (isActive: boolean) => {
    const result = await updateCustomer({ variables: { id, input: { isActive } } });

    if (result.data?.customerUpdate?.errors.length === 0) {
      notify({
        status: "success",
        text: isActive
          ? intl.formatMessage({
              defaultMessage: "Customer activated",
              description: "success toast after activating a customer",
              id: "6jt3RB",
            })
          : intl.formatMessage({
              defaultMessage: "Customer deactivated",
              description: "success toast after deactivating a customer",
              id: "SPzIC5",
            }),
      });
      closeDialog();
    }
  };

  const updateStatus = getMutationStatus({
    ...updateCustomerOpts,
    errors: updateCustomerOpts.data?.customerUpdate?.errors,
  });
  const email = <strong>{customer?.email ?? "..."}</strong>;
  const statusAction =
    params.action === "activate" || params.action === "deactivate" ? params.action : null;

  return (
    <>
      <CustomerDetailsPage
        customer={customer}
        canEdit={canEdit}
        canReadOrders={canReadOrders}
        disabled={loading || updateCustomerOpts.loading || removeCustomerOpts.loading}
        errors={updateCustomerOpts.data?.customerUpdate?.errors ?? []}
        saveButtonBar={updateStatus}
        onSubmit={handleSubmit}
        onDelete={() => navigate(customerUrl(id, { action: "remove" }))}
        onActivateToggle={() =>
          navigate(customerUrl(id, { action: customer?.isActive ? "deactivate" : "activate" }))
        }
      />
      <CustomerDeleteDialog
        confirmButtonState={getMutationStatus({
          ...removeCustomerOpts,
          errors: removeCustomerOpts.data?.customerDelete?.errors,
        })}
        email={email}
        onClose={closeDialog}
        onConfirm={() => void removeCustomer({ variables: { id } })}
        open={params.action === "remove" && canEdit}
      />
      <CustomerStatusChangeDialog
        confirmButtonState={updateStatus}
        email={email}
        onClose={closeDialog}
        onConfirm={() => void handleStatusConfirm(statusAction === "activate")}
        open={statusAction !== null && canEdit}
        variant={statusAction ?? "deactivate"}
      />
    </>
  );
};
