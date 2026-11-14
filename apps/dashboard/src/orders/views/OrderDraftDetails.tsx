// Adapted from saleor-dashboard: src/orders/views/OrderDetails/OrderDraftDetails/index.tsx and
// OrderDetailsMessages.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A draft's actions (PLAN M13.6), rendered by OrderDetails for a DRAFT order as in Saleor. The open
// dialog lives in the URL (`action=add-order-line|cancel`). Line changes save at once with Saleor's
// toasts and their errors are error toasts; Finalize's errors (what the draft is missing) show in
// red next to the customer, the billing address or the lines, with one toast saying so. Finalize opens the placed order; deleting goes to the drafts.
import { useMutation } from "@apollo/client";
import { useEffect } from "react";
import { defineMessages, useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import {
  type OrderDetailsFragment,
  OrderDraftCancelDocument,
  OrderDraftFinalizeDocument,
  OrderDraftUpdateDocument,
  type OrderErrorFragment,
  OrderLineDeleteDocument,
  OrderLinesAddDocument,
  OrderLineUpdateDocument,
} from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { getOrderErrorMessage } from "../../utils/errors";
import { OrderAddressEditDialog } from "../components/OrderAddressEditDialog/OrderAddressEditDialog";
import { OrderDraftCancelDialog } from "../components/OrderDraftCancelDialog/OrderDraftCancelDialog";
import { OrderDraftPage } from "../components/OrderDraftPage/OrderDraftPage";
import { OrderProductAddDialog } from "../components/OrderProductAddDialog/OrderProductAddDialog";
import { type OrderUrlQueryParams, orderDraftListUrl, orderDraftUrl, orderUrl } from "../urls";

// Saleor's OrderDetailsMessages toasts (Saleor's Mongolian says "order list" for "order line";
// ours is corrected in mn.json).
const messages = defineMessages({
  linesAdded: { id: "HlCkMT", defaultMessage: "Order line added" },
  lineUpdated: { id: "Fn3bE0", defaultMessage: "Order line updated" },
  lineDeleted: { id: "9OtpHt", defaultMessage: "Order line deleted" },
  draftFinalized: { id: "Hwp65F", defaultMessage: "Draft finalized" },
  draftDeleted: { id: "0ix6PR", defaultMessage: "Order cancelled" },
  draftUpdated: { id: "Jq1/jJ", defaultMessage: "Draft order updated" },
  cannotFinalize: {
    id: "mZD3xw",
    defaultMessage: "The draft can't be finalized yet. Fix the fields marked in red.",
    description: "draft finalize error toast",
  },
});

interface OrderDraftDetailsProps {
  id: string;
  order: OrderDetailsFragment;
  params: OrderUrlQueryParams;
}

export const OrderDraftDetails = ({ id, order, params }: OrderDraftDetailsProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const notify = useNotifier();

  const openModal = (action: NonNullable<OrderUrlQueryParams["action"]>) =>
    navigate(orderDraftUrl(id, { action }));
  const closeModal = () => navigate(orderDraftUrl(id), { replace: true });
  const notifyErrors = (errors: readonly OrderErrorFragment[]) => {
    for (const error of errors) {
      notify({ status: "error", text: getOrderErrorMessage(error, intl) ?? error.message ?? "" });
    }
  };

  const [addLines, addLinesOpts] = useMutation(OrderLinesAddDocument, {
    onCompleted: (result) => {
      if ((result.orderLinesCreate?.errors.length ?? 0) > 0) return;
      notify({ status: "success", text: intl.formatMessage(messages.linesAdded) });
      closeModal();
    },
  });
  const [updateLine, updateLineOpts] = useMutation(OrderLineUpdateDocument, {
    onCompleted: (result) => {
      const errors = result.orderLineUpdate?.errors ?? [];
      if (errors.length > 0) return notifyErrors(errors);
      notify({ status: "success", text: intl.formatMessage(messages.lineUpdated) });
    },
  });
  const [deleteLine, deleteLineOpts] = useMutation(OrderLineDeleteDocument, {
    onCompleted: (result) => {
      const errors = result.orderLineDelete?.errors ?? [];
      if (errors.length > 0) return notifyErrors(errors);
      notify({ status: "success", text: intl.formatMessage(messages.lineDeleted) });
    },
  });
  const [finalize, finalizeOpts] = useMutation(OrderDraftFinalizeDocument, {
    onCompleted: (result) => {
      // What is missing shows in red on the page; the toast only says so.
      if ((result.draftOrderComplete?.errors.length ?? 0) > 0) {
        return notify({ status: "error", text: intl.formatMessage(messages.cannotFinalize) });
      }
      notify({ status: "success", text: intl.formatMessage(messages.draftFinalized) });
      navigate(orderUrl(id), { replace: true });
    },
  });
  // One mutation for the customer and the billing address (Saleor's draftOrderUpdate); a dialog closes when it succeeds.
  const [updateDraft, updateDraftOpts] = useMutation(OrderDraftUpdateDocument, {
    onCompleted: (result) => {
      const errors = result.draftOrderUpdate?.errors ?? [];
      // A dialog shows its own errors; the customer picker has none, so toast them.
      if (errors.length > 0) return params.action ? undefined : notifyErrors(errors);
      notify({ status: "success", text: intl.formatMessage(messages.draftUpdated) });
      if (params.action) closeModal();
    },
  });
  const [cancelDraft, cancelDraftOpts] = useMutation(OrderDraftCancelDocument, {
    onCompleted: (result) => {
      if ((result.draftOrderDelete?.errors.length ?? 0) > 0) return;
      notify({ status: "success", text: intl.formatMessage(messages.draftDeleted) });
      navigate(orderDraftListUrl(), { replace: true });
    },
    update: (cache, result) => {
      // The draft is gone: drop it, so the drafts list refetches without it.
      if (result.data?.draftOrderDelete?.order) {
        cache.evict({ id: cache.identify({ __typename: "Order", id }) });
        cache.evict({ fieldName: "draftOrders" });
        cache.gc();
      }
    },
  });

  // A dialog opens without the previous attempt's errors.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reset functions are stable
  useEffect(() => {
    if (params.action === "add-order-line") addLinesOpts.reset();
    if (params.action === "cancel") cancelDraftOpts.reset();
    if (params.action?.startsWith("edit-")) updateDraftOpts.reset();
  }, [params.action]);

  const busy =
    updateLineOpts.loading ||
    deleteLineOpts.loading ||
    finalizeOpts.loading ||
    updateDraftOpts.loading;
  const updateState = getMutationStatus({
    ...updateDraftOpts,
    errors: updateDraftOpts.data?.draftOrderUpdate?.errors,
  });
  const updateErrors = updateDraftOpts.data?.draftOrderUpdate?.errors ?? [];
  // Finalize's errors stay until fixed: one about the customer, the billing address or the
  // missing products goes once the draft has it.
  const finalizeErrors = (finalizeOpts.data?.draftOrderComplete?.errors ?? []).filter(
    (error) =>
      !(error.field === "userEmail" && order.userEmail) &&
      !(error.field === "billingAddress" && order.billingAddress) &&
      !(error.field === "lines" && error.code === "REQUIRED" && order.lines.length > 0),
  );

  return (
    <>
      <OrderDraftPage
        order={order}
        disabled={busy}
        finalizeState={getMutationStatus({
          ...finalizeOpts,
          errors: finalizeOpts.data?.draftOrderComplete?.errors,
        })}
        onBack={() => navigate(orderDraftListUrl())}
        onDraftFinalize={() => void finalize({ variables: { id } })}
        onDraftRemove={() => openModal("cancel")}
        onOrderLineAdd={() => openModal("add-order-line")}
        onOrderLineChange={(lineId, quantity) =>
          void updateLine({ variables: { id: lineId, input: { quantity } } })
        }
        onOrderLineRemove={(lineId) => void deleteLine({ variables: { id: lineId } })}
        onCustomerChange={(change) => void updateDraft({ variables: { id, input: change } })}
        onBillingAddressEdit={() => openModal("edit-billing-address")}
        errors={finalizeErrors}
      />
      <OrderAddressEditDialog
        open={params.action === "edit-billing-address"}
        address={order.billingAddress}
        confirmButtonState={updateState}
        errors={updateErrors}
        onClose={closeModal}
        onSubmit={(billingAddress) =>
          void updateDraft({ variables: { id, input: { billingAddress } } })
        }
      />
      <OrderProductAddDialog
        open={params.action === "add-order-line"}
        confirmButtonState={getMutationStatus({
          ...addLinesOpts,
          errors: addLinesOpts.data?.orderLinesCreate?.errors,
        })}
        errors={addLinesOpts.data?.orderLinesCreate?.errors ?? []}
        onClose={closeModal}
        onSubmit={(variants) =>
          void addLines({
            variables: {
              id,
              input: variants.map((variant) => ({ variantId: variant.id, quantity: 1 })),
            },
          })
        }
      />
      <OrderDraftCancelDialog
        open={params.action === "cancel"}
        orderNumber={order.number}
        confirmButtonState={getMutationStatus({
          ...cancelDraftOpts,
          errors: cancelDraftOpts.data?.draftOrderDelete?.errors,
        })}
        errors={cancelDraftOpts.data?.draftOrderDelete?.errors ?? []}
        onClose={closeModal}
        onConfirm={() => void cancelDraft({ variables: { id } })}
      />
    </>
  );
};
