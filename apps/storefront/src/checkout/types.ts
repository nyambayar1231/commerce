// View models and action states of the checkout (ARCHITECTURE §10.9). The components import these
// types only; `mappers.ts` turns generated GraphQL into them, so money reaches the UI already
// formatted.

import type {
  AccountErrorKey,
  AddressField,
  AddressView,
  CountryOption,
  OrderDetailView,
} from "@/lib/account/types";
import type { AuthErrorKey } from "@/lib/auth/types";
import type { CartLineView } from "@/lib/cart/types";

export const STEPS = ["contact", "shipping", "payment"] as const;
export type CheckoutStep = (typeof STEPS)[number];

/** Keys of the `checkout.errors` message namespace. */
export type CheckoutErrorKey =
  | "generic"
  | "unavailable"
  | "invalidAttempt"
  | "providerUnavailable"
  | "insufficientStock"
  | "notAvailable"
  | "notFullyPaid"
  | "paymentDeclined"
  | "paymentChanged"
  | "invalidDeliveryMethod"
  | "invalidEmail";

/** What a checkout Server Action returns; the form shows `message` in an `aria-live` region. */
export type CheckoutActionState<Field extends string = never> = {
  status: "idle" | "error" | "success";
  message?: CheckoutErrorKey;
  fieldErrors?: Partial<Record<Field, AccountErrorKey>>;
  /** What was submitted, so the form keeps it after an error. */
  values?: Partial<Record<Field, string>>;
  /**
   * `placeOrder` only: a new attempt id for the next try, given when the old one is spent (the
   * gateway declined, or the amount changed) and withheld when a retry must reuse it.
   */
  nextAttemptId?: string;
};

/** The contact form's state: the email field's error is a key of the `errors` namespace. */
export type ContactActionState = {
  status: "idle" | "error";
  message?: CheckoutErrorKey;
  fieldErrors?: { email?: AuthErrorKey };
  values?: { email?: string };
};
export type ContactAction = (
  state: ContactActionState,
  formData: FormData,
) => Promise<ContactActionState>;
export type DeliveryAction = (
  state: CheckoutActionState,
  formData: FormData,
) => Promise<CheckoutActionState>;
export type PlaceOrderState = CheckoutActionState<AddressField>;
export type PlaceOrderAction = (
  state: PlaceOrderState,
  formData: FormData,
) => Promise<PlaceOrderState>;

export type ShippingMethodView = {
  id: string;
  name: string;
  price: string;
  message: string;
  active: boolean;
};

export type CheckoutView = {
  token: string;
  email: string | null;
  isShippingRequired: boolean;
  lines: CartLineView[];
  /** The number of items (the sum of the line quantities). */
  quantity: number;
  shippingAddress: AddressView | null;
  billingAddress: AddressView | null;
  shippingMethods: ShippingMethodView[];
  /** The chosen delivery method's id, when there is one. */
  shippingMethodId: string | null;
  subtotal: string;
  shipping: string;
  total: string;
  /** What the checkout flow needs to know without the formatted fields. */
  hasEmail: boolean;
  hasShippingAddress: boolean;
  hasDeliveryMethod: boolean;
};

export type CheckoutSession =
  | { status: "guest" }
  | { status: "authenticated"; email: string; firstName: string; lastName: string };

export type CheckoutPageData = {
  checkout: CheckoutView;
  session: CheckoutSession;
  /** The signed-in customer's saved addresses (none for a guest). */
  savedAddresses: AddressView[];
  countries: CountryOption[];
};

/** What `getCheckoutPage()` returns: no cart to pay for, an outage, or the page's data. */
export type CheckoutPageLoad =
  | { status: "empty" }
  | { status: "unavailable" }
  | ({ status: "ready" } & CheckoutPageData);

export type OrderConfirmationView = {
  order: OrderDetailView;
  /** The email the confirmation was sent to. */
  email: string;
};
