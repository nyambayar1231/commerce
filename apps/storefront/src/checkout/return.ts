import "server-only";

import {
  CheckoutCompleteDocument,
  CheckoutPaymentStateDocument,
  TransactionProcessDocument,
} from "@/gql/graphql";
import { mutate } from "@/lib/api";
import { checkoutGlobalId, clearCheckoutCookie, readCheckoutToken } from "@/lib/cart/cookies";
import { log } from "@/lib/log";

// The shopper's way back from a payment gateway's page (ADR-0016, ARCHITECTURE §10.9). The API
// already makes the order once the payment is in (webhook or reconciliation); this only works out
// where the shopper should be now, asking the API to read the payment at its gateway first
// (Saleor's transactionProcess) so they rarely wait for the webhook. Every step is idempotent: a
// reload or a second tab ends in the same place.

export type ReturnDestination =
  | "/cart"
  | "/checkout/pending"
  | "/checkout?step=payment&payment=expired"
  | "/checkout?step=payment&payment=notCompleted"
  | `/order/${string}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isPaid = (chargeStatus: string) => chargeStatus === "FULL" || chargeStatus === "OVERCHARGED";

async function readPayment(id: string) {
  const result = await mutate(CheckoutPaymentStateDocument, { variables: { id } });
  return result.ok ? result.data.checkout : ("unavailable" as const);
}

export async function settlePaymentReturn(): Promise<ReturnDestination> {
  const token = await readCheckoutToken();
  if (token === null) return "/cart";
  const id = checkoutGlobalId(token);

  let checkout = await readPayment(id);
  if (checkout === "unavailable") return "/checkout/pending";
  if (checkout !== null && !isPaid(checkout.chargeStatus)) {
    const open = (checkout.transactions ?? []).filter((t) => t.chargePendingAmount.amount > 0);
    for (const transaction of open) {
      await mutate(TransactionProcessDocument, { variables: { token: transaction.token } });
    }
    checkout = await readPayment(id);
    if (checkout === "unavailable") return "/checkout/pending";
    if (checkout !== null && !isPaid(checkout.chargeStatus)) {
      // Still at the gateway (paid in the app, not yet confirmed): wait. Nothing open: it expired
      // or was abandoned; the shopper tries again.
      return (checkout.transactions ?? []).some((t) => t.chargePendingAmount.amount > 0)
        ? "/checkout/pending"
        : "/checkout?step=payment&payment=expired";
    }
  }

  // Paid, or completed already by the API (the checkout no longer reads): completion is
  // idempotent and answers with the order.
  const done = await mutate(CheckoutCompleteDocument, { variables: { id } });
  if (!done.ok) return "/checkout/pending";
  const payload = done.data.checkoutComplete;
  const orderToken = payload?.order?.token;
  if (
    (payload?.errors ?? []).length === 0 &&
    typeof orderToken === "string" &&
    UUID.test(orderToken)
  ) {
    await clearCheckoutCookie();
    return `/order/${orderToken}`;
  }
  if (checkout === null) {
    // No checkout and no order for it: nothing to come back to.
    await clearCheckoutCookie();
    return "/cart";
  }
  // Paid but it can't become an order (stock sold meanwhile): the API refunds it and tells staff.
  log.warn("checkout.paid_not_completed", { code: payload?.errors?.[0]?.code ?? null });
  return "/checkout?step=payment&payment=notCompleted";
}
