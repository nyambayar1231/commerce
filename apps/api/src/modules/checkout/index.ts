// Public surface of the `checkout` module (ARCHITECTURE.md §2).

export type { Address, AddressError, AddressInput, AddressType } from "./addresses.ts";
export { cleanAddress, parseStoredAddress } from "./addresses.ts";

export type {
  CheckoutError,
  CheckoutErrorCode,
  CheckoutLineInput,
  CheckoutLineQuantityInput,
  CheckoutLineRow,
  CheckoutResult,
  CheckoutRow,
} from "./checkouts.ts";
export {
  addCheckoutLines,
  CheckoutNotFoundError,
  createCheckout,
  deleteCheckoutLines,
  getCheckout,
  getCheckoutLines,
  getCheckoutShippingMethod,
  MAX_CHECKOUT_LINE_QUANTITY,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
  updateCheckoutEmail,
  updateCheckoutLines,
} from "./checkouts.ts";
export type { CountryCode } from "./countries.ts";
export { COUNTRY_CODES, countryName, isCountryCode } from "./countries.ts";
export type { CheckoutLoaders } from "./loaders.ts";
export { createCheckoutLoaders } from "./loaders.ts";
export type {
  ShippingError,
  ShippingErrorCode,
  ShippingMethodInput,
  ShippingMethodResult,
  ShippingMethodRow,
} from "./shippingMethods.ts";
export {
  createShippingMethod,
  DEMO_SHIPPING_METHODS,
  deleteShippingMethod,
  getShippingMethod,
  listActiveShippingMethods,
  listShippingMethods,
  ShippingMethodNotFoundError,
  seedDemoShippingMethods,
  updateShippingMethod,
} from "./shippingMethods.ts";
export type {
  CheckoutTotals,
  CheckoutTotalsLine,
  TaxedMoney as CheckoutTaxedMoney,
} from "./totals.ts";
export { calculateCheckoutTotals, taxedMoney } from "./totals.ts";
