// View-model types of the customer account (ARCHITECTURE §10.3, §10.10), shared by the loaders and
// Server Actions in src/lib/account and the components in src/ui, which may import only
// `@/lib/*/types`. Money and dates are already formatted strings (§10.11).

/** Keys of the `errors` message namespace that the account forms can show. */
export type AccountErrorKey =
  | "required"
  | "invalid"
  | "tooLong"
  | "notFound"
  | "unavailable"
  | "generic"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordsMismatch"
  | "wrongPassword";

/** The state `useActionState` holds for an account form. Passwords are never echoed back. */
export type ActionState<Field extends string> = {
  status: "idle" | "error" | "success";
  message?: AccountErrorKey;
  fieldErrors?: Partial<Record<Field, AccountErrorKey>>;
  /** What was submitted, so the form keeps it after an error (never a password). */
  values?: Partial<Record<Field, string>>;
};

export type AddressField =
  | "firstName"
  | "lastName"
  | "companyName"
  | "country"
  | "countryArea"
  | "city"
  | "cityArea"
  | "streetAddress1"
  | "streetAddress2"
  | "postalCode"
  | "phone";

export type ProfileField = "firstName" | "lastName";
export type PasswordField = "oldPassword" | "password" | "confirm";

export type AddressActionState = ActionState<AddressField>;
export type ProfileActionState = ActionState<ProfileField>;
export type PasswordActionState = ActionState<PasswordField>;
export type SimpleActionState = ActionState<never>;

export type AddressAction = (
  state: AddressActionState,
  formData: FormData,
) => Promise<AddressActionState>;
export type ProfileAction = (
  state: ProfileActionState,
  formData: FormData,
) => Promise<ProfileActionState>;
export type PasswordAction = (
  state: PasswordActionState,
  formData: FormData,
) => Promise<PasswordActionState>;
export type SimpleAction = (
  state: SimpleActionState,
  formData: FormData,
) => Promise<SimpleActionState>;

export type CountryOption = { code: string; name: string };

/** A saved address (address book, order address). */
export type AddressView = {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  cityArea: string;
  postalCode: string;
  countryArea: string;
  countryCode: string;
  countryName: string;
  phone: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

/** The statuses a customer can see (drafts are never returned to customers). */
export type OrderStatusKey = "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CANCELED";
export type PaymentStateKey = "none" | "partial" | "full" | "overcharged";

export type OrderSummaryView = {
  id: string;
  number: string;
  createdIso: string;
  createdLabel: string;
  status: OrderStatusKey;
  total: string;
  itemCount: number;
};

/** An entry of the order timeline, from data the customer may read (never staff events). */
export type TimelineEntryView =
  | { kind: "placed"; iso: string; label: string }
  | { kind: "fulfilled"; iso: string; label: string; itemCount: number; trackingNumber: string }
  | { kind: "canceled"; iso: string; label: string };

export type OrderLineView = {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
};

export type OrderDetailView = OrderSummaryView & {
  paymentState: PaymentStateKey;
  lines: OrderLineView[];
  subtotal: string;
  shipping: string;
  shippingMethod: string | null;
  shippingAddress: AddressView | null;
  billingAddress: AddressView | null;
  /** Newest first. */
  timeline: TimelineEntryView[];
};

export type OrdersPageView = {
  orders: OrderSummaryView[];
  previousCursor: string | null;
  nextCursor: string | null;
};

export type AccountOverviewView = {
  defaultShipping: AddressView | null;
  defaultBilling: AddressView | null;
  recentOrders: OrderSummaryView[];
};

export type AddressBookView = { addresses: AddressView[]; countries: CountryOption[] };
