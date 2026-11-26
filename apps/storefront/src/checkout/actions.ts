"use server";

import { cleanAddress } from "@commerce/contracts";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  type AddressInput,
  CheckoutBillingAddressUpdateDocument,
  CheckoutCompleteDocument,
  CheckoutDeliveryMethodUpdateDocument,
  CheckoutEmailUpdateDocument,
  CheckoutPaymentStateDocument,
  type CheckoutPaymentStateQuery,
  CheckoutShippingAddressUpdateDocument,
  TransactionInitializeDocument,
} from "@/gql/graphql";
import type { AddressActionState } from "@/lib/account/types";
import { addressErrorsFromApi, readAddressValues, validateAddress } from "@/lib/account/validation";
import { mutate } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { textField, validateEmail } from "@/lib/auth/validation";
import { checkoutGlobalId, clearCheckoutCookie, readCheckoutToken } from "@/lib/cart/cookies";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { findProvider } from "./payment/providers";
import type {
  CheckoutActionState,
  CheckoutErrorKey,
  ContactActionState,
  PlaceOrderState,
} from "./types";

// Checkout Server Actions (ARCHITECTURE §10.9). Next checks each action's Origin against the host.
// The browser never sends a price, an amount or the checkout id: the checkout is the one in the
// HttpOnly cookie, and every value that matters is read from the API again. Only async functions
// are exported: everything exported here is callable from a browser.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GLOBAL_ID = /^[A-Za-z0-9+/_-]{8,200}={0,2}$/;

type ApiFault = { code: string; field?: string | null };

/** The API refuses writes to a completed checkout with INVALID on the `id` field. */
const isCompleted = (errors: readonly ApiFault[]) =>
  errors.some((error) => error.code === "INVALID" && error.field === "id");

/**
 * The checkout in the cookie, or the way out: no cookie sends the shopper to the cart; so does a
 * checkout the API says is gone or completed (the cookie is cleared first).
 */
async function checkoutId(): Promise<string> {
  const token = await readCheckoutToken();
  if (token === null) redirect("/cart");
  return checkoutGlobalId(token);
}

async function leaveCompleted(): Promise<never> {
  await clearCheckoutCookie();
  return redirect("/cart");
}

const stepUrl = (step: "contact" | "shipping" | "payment") => `/checkout?step=${step}`;

// ── Contact ─────────────────────────────────────────────────────────────────────────────────

/** Sets the checkout's email: a signed-in customer's own, a guest's from the form. */
export async function setEmail(
  _state: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const user = await getCurrentUser();
  // A signed-in customer's email comes from their session, never from the form.
  const email =
    user.status === "authenticated" ? user.user.email : textField(formData, "email").trim();
  const errors = validateEmail(email);
  if (errors) {
    return { status: "error", fieldErrors: errors, values: { email } };
  }

  const id = await checkoutId();
  const result = await mutate(CheckoutEmailUpdateDocument, { variables: { id, email } });
  if (!result.ok) return { status: "error", message: "unavailable", values: { email } };
  const apiErrors = result.data.checkoutEmailUpdate?.errors ?? [];
  if (isCompleted(apiErrors)) return leaveCompleted();
  if (apiErrors.length > 0) {
    return apiErrors[0]?.field === "email"
      ? { status: "error", fieldErrors: { email: "invalid" }, values: { email } }
      : { status: "error", message: "generic", values: { email } };
  }
  redirect(stepUrl("shipping"));
}

// ── Shipping ────────────────────────────────────────────────────────────────────────────────

/** Saves the shipping address; the page then shows the delivery methods for it. */
export async function saveShippingAddress(
  _state: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const values = readAddressValues(formData);
  const errors = validateAddress(values);
  if (errors) return { status: "error", fieldErrors: errors, values };
  const cleaned = cleanAddress(values);
  if (!cleaned.ok) return { status: "error", message: "generic", values };

  const id = await checkoutId();
  const result = await mutate(CheckoutShippingAddressUpdateDocument, {
    variables: { id, address: cleaned.address as AddressInput },
  });
  if (!result.ok) return { status: "error", message: "unavailable", values };
  const apiErrors = result.data.checkoutShippingAddressUpdate?.errors ?? [];
  if (isCompleted(apiErrors)) return leaveCompleted();
  if (apiErrors.length > 0) {
    return { status: "error", ...addressErrorsFromApi(apiErrors), values };
  }
  refresh();
  return { status: "success" };
}

/** Chooses the delivery method; the API checks it is one of the checkout's. */
export async function chooseDelivery(
  _state: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const deliveryMethodId = textField(formData, "deliveryMethodId");
  if (!GLOBAL_ID.test(deliveryMethodId))
    return { status: "error", message: "invalidDeliveryMethod" };

  const id = await checkoutId();
  const result = await mutate(CheckoutDeliveryMethodUpdateDocument, {
    variables: { id, deliveryMethodId },
  });
  if (!result.ok) return { status: "error", message: "unavailable" };
  const apiErrors = result.data.checkoutDeliveryMethodUpdate?.errors ?? [];
  if (isCompleted(apiErrors)) return leaveCompleted();
  if (apiErrors.length > 0) {
    const code = apiErrors[0]?.code;
    return {
      status: "error",
      message:
        code === "INVALID_SHIPPING_METHOD" || code === "DELIVERY_METHOD_NOT_APPLICABLE"
          ? "invalidDeliveryMethod"
          : "generic",
    };
  }
  redirect(stepUrl("payment"));
}

// ── Place order ─────────────────────────────────────────────────────────────────────────────

const failure = (
  message: CheckoutErrorKey,
  extra: Partial<PlaceOrderState> = {},
): PlaceOrderState => ({ status: "error", message, ...extra });

/** A spent attempt id (declined, or the amount changed) is replaced; any other retry reuses it. */
const spent = (message: CheckoutErrorKey): PlaceOrderState =>
  failure(message, { nextAttemptId: crypto.randomUUID() });

function completionFailure(errors: readonly ApiFault[]): PlaceOrderState {
  const code = errors[0]?.code;
  switch (code) {
    case "INSUFFICIENT_STOCK":
      return failure("insufficientStock");
    case "PRODUCT_NOT_PUBLISHED":
      return failure("notAvailable");
    case "CHECKOUT_NOT_FULLY_PAID":
      // Prices moved after the payment: the next try charges the remainder under a new key.
      return spent("notFullyPaid");
    default:
      return failure("generic");
  }
}

/** Where a missing piece of the checkout is entered. */
function missingStep(code: string): ReturnType<typeof stepUrl> | null {
  switch (code) {
    case "EMAIL_NOT_SET":
      return stepUrl("contact");
    case "SHIPPING_ADDRESS_NOT_SET":
    case "SHIPPING_METHOD_NOT_SET":
    case "INVALID_SHIPPING_METHOD":
      return stepUrl("shipping");
    case "BILLING_ADDRESS_NOT_SET":
      return stepUrl("payment");
    default:
      return null;
  }
}

const isPaid = (chargeStatus: string) => chargeStatus === "FULL" || chargeStatus === "OVERCHARGED";

/** The gateway page in `transactionInitialize`'s `data` (`{ url }`), or null. */
function gatewayPageUrl(data: unknown): string | null {
  if (data === null || typeof data !== "object") return null;
  const url = (data as { url?: unknown }).url;
  return typeof url === "string" && url !== "" ? url : null;
}

/**
 * Pays for the checkout and completes it into an order, exactly once (ARCHITECTURE §10.9):
 *  1. validate the attempt id (a UUID rendered into the form) and the provider (enabled);
 *  2. read the checkout live: no lines → cart; missing pieces → their step;
 *  3. billing address (the shipping address copied from the live read, or the validated form);
 *  4. unless the checkout is already fully charged, `transactionInitialize` with the attempt id as
 *     idempotency key; no amount: the API charges what is still uncovered;
 *  5. `checkoutComplete` (idempotent in the API) → clear the cookie → the order page.
 * A double submit, a retry after a timeout and a retry after a failed completion never charge
 * twice: the API returns the first result for the same key, a fully charged checkout skips step 4,
 * and completing a completed checkout returns its order.
 */
export async function placeOrder(
  _state: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  const attemptId = textField(formData, "attemptId");
  if (!UUID.test(attemptId)) return failure("invalidAttempt");
  const provider = findProvider(textField(formData, "providerId"), getEnv().paymentProviders);
  if (provider === null) return failure("providerUnavailable");

  const billingValues = readAddressValues(formData);
  const sameAsShipping = textField(formData, "billingSameAsShipping") === "true";
  if (!sameAsShipping) {
    const errors = validateAddress(billingValues);
    if (errors) return { status: "error", fieldErrors: errors, values: billingValues };
  }

  const id = await checkoutId();
  const read = await readPayment(id);
  if (read === "unavailable") return failure("unavailable", { values: billingValues });
  if (read === null) return leaveCompleted();
  if (read.lines.length === 0) redirect("/cart");
  if (!read.email) redirect(stepUrl("contact"));
  if (!read.shippingAddress || !read.delivery?.shippingMethod) redirect(stepUrl("shipping"));

  let paid = isPaid(read.chargeStatus);

  // Billing: never touched once the checkout is paid (a retry changes nothing).
  if (!paid) {
    const address = sameAsShipping
      ? shippingAsInput(read.shippingAddress)
      : billingFromForm(billingValues);
    if (address === null) return failure("generic", { values: billingValues });
    const billing = await mutate(CheckoutBillingAddressUpdateDocument, {
      variables: { id, address },
    });
    if (!billing.ok) return failure("unavailable", { values: billingValues });
    const billingErrors = billing.data.checkoutBillingAddressUpdate?.errors ?? [];
    if (isCompleted(billingErrors)) return completeCheckout(id);
    if (billingErrors.length > 0) {
      return {
        status: "error",
        fieldErrors: addressErrorsFromApi(billingErrors).fieldErrors,
        message: "generic",
        values: billingValues,
      };
    }

    const init = await mutate(TransactionInitializeDocument, {
      variables: {
        id,
        gatewayId: provider.gatewayId,
        data: provider.gatewayData({ storefrontUrl: getEnv().storefrontUrl }),
        idempotencyKey: attemptId,
      },
    });
    // A timeout may still have charged: nothing is assumed, the same attempt id is retried.
    if (!init.ok) return failure("unavailable", { values: billingValues });
    const payload = init.data.transactionInitialize;
    const initErrors = payload?.errors ?? [];
    if (initErrors.length > 0) {
      const first = initErrors[0];
      if (first?.code === "UNIQUE") return spent("paymentChanged");
      // Completed meanwhile (a retry whose first attempt already finished): completion answers
      // with its order.
      if (isCompleted(initErrors)) return completeCheckout(id);
      // "Nothing left to pay": a concurrent or earlier attempt covered the total. Trust the API,
      // not the error: read the checkout again and carry on only when it is really paid.
      if (first?.field === "amount" && first.code === "INVALID") {
        const again = await readPayment(id);
        if (again === "unavailable") return failure("unavailable", { values: billingValues });
        if (again === null) return leaveCompleted();
        paid = isPaid(again.chargeStatus);
      }
      if (!paid) return failure("generic", { values: billingValues });
    } else {
      if (payload?.transaction == null) return failure("generic", { values: billingValues });
      const type = payload.transactionEvent?.type;
      if (type?.endsWith("_FAILURE")) return spent("paymentDeclined");
      // A gateway the shopper pays on its own page (Wire, ADR-0016): send them there. The order is
      // made by the API once the payment is in; they come back to /checkout/return.
      if (type === "CHARGE_ACTION_REQUIRED") {
        const url = gatewayPageUrl(payload.data);
        // No page: this attempt's payment expired (a retry of an old attempt). Start a new one.
        if (url === null) return spent("paymentExpired");
        if (!provider.allowsRedirect(url, getEnv())) {
          log.error("checkout.payment_redirect_refused", { provider: provider.id });
          return failure("generic", { values: billingValues });
        }
        redirect(url);
      }
    }
  }

  return completeCheckout(id);
}

/** The checkout as the payment needs it: a live read, never cached. */
async function readPayment(id: string) {
  const result = await mutate(CheckoutPaymentStateDocument, { variables: { id } });
  if (!result.ok) return "unavailable" as const;
  return result.data.checkout;
}

type PaymentCheckout = NonNullable<CheckoutPaymentStateQuery["checkout"]>;

/** The checkout's own shipping address as the billing address (copied on the server). */
function shippingAsInput(address: NonNullable<PaymentCheckout["shippingAddress"]>) {
  const cleaned = cleanAddress({
    firstName: address.firstName,
    lastName: address.lastName,
    companyName: address.companyName,
    country: address.country.code,
    countryArea: address.countryArea,
    city: address.city,
    cityArea: address.cityArea,
    streetAddress1: address.streetAddress1,
    streetAddress2: address.streetAddress2,
    postalCode: address.postalCode,
    phone: address.phone ?? "",
  });
  return cleaned.ok ? (cleaned.address as AddressInput) : null;
}

function billingFromForm(values: Parameters<typeof cleanAddress>[0]) {
  const cleaned = cleanAddress(values);
  return cleaned.ok ? (cleaned.address as AddressInput) : null;
}

/** `checkoutComplete`, then the order page; or the reason it can't be placed. */
async function completeCheckout(id: string): Promise<PlaceOrderState> {
  const result = await mutate(CheckoutCompleteDocument, { variables: { id } });
  if (!result.ok) return failure("unavailable");
  const payload = result.data.checkoutComplete;
  const errors = payload?.errors ?? [];
  if (errors.length > 0) {
    const step = missingStep(errors[0]?.code ?? "");
    if (step !== null) redirect(step);
    if (errors[0]?.code === "NO_LINES") redirect("/cart");
    return completionFailure(errors);
  }
  const token = payload?.order?.token;
  if (typeof token !== "string" || !UUID.test(token)) return failure("generic");
  await clearCheckoutCookie();
  redirect(`/order/${token}`);
}
