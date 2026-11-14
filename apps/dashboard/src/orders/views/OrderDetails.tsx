// Adapted from saleor-dashboard: src/orders/views/OrderDetails/OrderDetails.tsx and
// OrderDetailsMessages.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Loads the order named by the URL and runs its actions (PLAN M6.5). The open dialog lives in the
// URL as Saleor's (`action=cancel|mark-paid|refund`, `id=<transaction>` for a refund); each
// mutation returns the order (or the refunded transaction) so the page updates from Apollo's
// cache, then closes the dialog with Saleor's toast. Refunds are offered only to staff with
// HANDLE_PAYMENTS (the API's permission). An unknown id is not found. A draft (M13.6) renders the
// draft page instead, as Saleor's OrderDetails does.
import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { defineMessages, useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useUser } from "../../auth/AuthProvider";
import { hasPermission } from "../../auth/misc";
import { getMutationStatus } from "../../categories/mutationStatus";
import {
  OrderCancelDocument,
  OrderDetailsDocument,
  OrderMarkAsPaidDocument,
  OrderTransactionRefundDocument,
} from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../NotFound";
import { OrderCancelDialog } from "../components/OrderCancelDialog/OrderCancelDialog";
import { OrderDetailsPage } from "../components/OrderDetailsPage/OrderDetailsPage";
import { OrderMarkAsPaidDialog } from "../components/OrderMarkAsPaidDialog/OrderMarkAsPaidDialog";
import { OrderTransactionRefundDialog } from "../components/OrderTransactionRefundDialog/OrderTransactionRefundDialog";
import { type OrderUrlDialog, orderFulfillUrl, orderUrl, parseOrderUrl } from "../urls";
import { OrderDraftDetails } from "./OrderDraftDetails";

// Saleor's OrderDetailsMessages toasts for these actions.
const messages = defineMessages({
  orderCanceled: {
    id: "0ix6PR",
    defaultMessage: "Order cancelled",
  },
  markedAsPaid: {
    id: "lL1HTg",
    defaultMessage: "Order marked as paid",
  },
  refunded: {
    id: "kVKMLf",
    defaultMessage: "Refund request sent to payment provider",
    description: "notifier after transfer funds mutation succeeds",
  },
});

export const OrderDetails = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const params = parseOrderUrl(searchParams);
  const navigate = useNavigate();
  const intl = useIntl();
  const notify = useNotifier();
  const { user } = useUser();
  const { data, loading } = useQuery(OrderDetailsDocument, { variables: { id } });
  const order = data?.order ?? undefined;
  const canRefund = !!user && hasPermission("HANDLE_PAYMENTS", user);

  const openModal = (action: OrderUrlDialog, transactionId?: string) =>
    navigate(orderUrl(id, { action, id: transactionId }));
  const closeModal = () => navigate(orderUrl(id), { replace: true });

  const [cancelOrder, cancelOpts] = useMutation(OrderCancelDocument, {
    onCompleted: (result) => {
      if ((result.orderCancel?.errors.length ?? 0) > 0) return;
      notify({ status: "success", text: intl.formatMessage(messages.orderCanceled) });
      closeModal();
    },
  });
  const [markAsPaid, markAsPaidOpts] = useMutation(OrderMarkAsPaidDocument, {
    onCompleted: (result) => {
      if ((result.orderMarkAsPaid?.errors.length ?? 0) > 0) return;
      notify({ status: "success", text: intl.formatMessage(messages.markedAsPaid) });
      closeModal();
    },
  });
  const [refund, refundOpts] = useMutation(OrderTransactionRefundDocument, {
    onCompleted: (result) => {
      if ((result.transactionRequestAction?.errors.length ?? 0) > 0) return;
      notify({ status: "success", text: intl.formatMessage(messages.refunded) });
      closeModal();
    },
  });

  const [transactionReference, setTransactionReference] = useState("");
  const refundTransaction = order?.transactions.find((transaction) => transaction.id === params.id);
  // `chargedAmount` is what is charged and not yet refunded (Saleor's), the most a refund can take.
  const maxRefund = refundTransaction?.chargedAmount ?? null;
  const [refundAmount, setRefundAmount] = useState("");

  // A dialog opens with a fresh form and without the previous attempt's errors — only on opening,
  // not on every mutation-state change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reset functions are stable
  useEffect(() => {
    if (params.action === "mark-paid") {
      setTransactionReference("");
      markAsPaidOpts.reset();
    }
    if (params.action === "cancel") cancelOpts.reset();
    if (params.action === "refund") refundOpts.reset();
  }, [params.action]);
  useEffect(() => {
    if (params.action === "refund" && maxRefund) setRefundAmount(String(maxRefund.amount));
  }, [params.action, maxRefund?.amount, maxRefund]);

  if (!loading && !order) {
    return <NotFound />;
  }

  if (order?.status === "DRAFT") {
    return <OrderDraftDetails id={id} order={order} params={params} />;
  }

  return (
    <>
      <OrderDetailsPage
        order={order}
        onOrderFulfill={() => navigate(orderFulfillUrl(id))}
        onOrderCancel={() => openModal("cancel")}
        onMarkAsPaid={() => openModal("mark-paid")}
        onRefund={canRefund ? (transactionId) => openModal("refund", transactionId) : undefined}
      />
      {order && (
        <>
          <OrderCancelDialog
            open={params.action === "cancel"}
            number={order.number}
            confirmButtonState={getMutationStatus({
              ...cancelOpts,
              errors: cancelOpts.data?.orderCancel?.errors,
            })}
            errors={cancelOpts.data?.orderCancel?.errors ?? []}
            onClose={closeModal}
            onSubmit={() => void cancelOrder({ variables: { id } })}
          />
          <OrderMarkAsPaidDialog
            open={params.action === "mark-paid"}
            confirmButtonState={getMutationStatus({
              ...markAsPaidOpts,
              errors: markAsPaidOpts.data?.orderMarkAsPaid?.errors,
            })}
            errors={markAsPaidOpts.data?.orderMarkAsPaid?.errors ?? []}
            transactionReference={transactionReference}
            onTransactionReferenceChange={setTransactionReference}
            onClose={closeModal}
            onConfirm={() =>
              void markAsPaid({
                variables: { id, transactionReference: transactionReference.trim() || null },
              })
            }
          />
          {maxRefund && refundTransaction && (
            <OrderTransactionRefundDialog
              open={params.action === "refund" && canRefund}
              maxAmount={maxRefund}
              amount={refundAmount}
              onAmountChange={setRefundAmount}
              confirmButtonState={getMutationStatus({
                ...refundOpts,
                errors: refundOpts.data?.transactionRequestAction?.errors,
              })}
              errors={(refundOpts.data?.transactionRequestAction?.errors ?? []).map((error) => ({
                ...error,
                message: error.message ?? "",
              }))}
              onClose={closeModal}
              onSubmit={() =>
                void refund({
                  variables: { transactionId: refundTransaction.id, amount: refundAmount.trim() },
                })
              }
            />
          )}
        </>
      )}
    </>
  );
};
