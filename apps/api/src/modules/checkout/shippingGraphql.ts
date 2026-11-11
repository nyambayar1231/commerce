import { builder } from "../../graphql/builder.ts";
import { decodeGlobalId, fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { MoneyType, TaxedMoneyType } from "../../graphql/money.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { Decimal } from "../../graphql/scalars.ts";
import { toMoney } from "../catalog/index.ts";
import {
  type CheckoutPayload,
  CheckoutType,
  checkoutLinesPayload,
  runCheckoutWrite,
} from "./graphql.ts";
import {
  type Address,
  type AddressInput as AddressInputData,
  COUNTRY_CODES,
  type CountryCode,
  countryName,
  createShippingMethod,
  deleteShippingMethod,
  getCheckoutShippingMethod,
  listActiveShippingMethods,
  listShippingMethods,
  parseStoredAddress,
  type ShippingError,
  ShippingMethodNotFoundError,
  type ShippingMethodResult,
  type ShippingMethodRow,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
  updateShippingMethod,
} from "./index.ts";

// Shipping and addresses on the checkout (M5.2): Saleor's address types, its ShippingMethod (what a
// buyer chooses) and ShippingMethodType (what staff manage) over our flat `shipping_method` list
// (PLAN M5 decisions 1, 3 and 6), and the checkout's address and delivery mutations.

const MANAGE_SHIPPING = "Requires one of the following permissions: MANAGE_SHIPPING.";

// ---------------------------------------------------------------------------------------------
// Addresses

const CountryCodeEnum = builder.enumType("CountryCode", { values: COUNTRY_CODES });

const CountryDisplay = builder.objectRef<CountryCode>("CountryDisplay").implement({
  description: "Represents country.",
  fields: (t) => ({
    code: t.string({ description: "Country code.", resolve: (code) => code }),
    country: t.string({ description: "Country name.", resolve: (code) => countryName(code) }),
  }),
});

// Saleor's Address without `id`, metadata and the default-address flags: a checkout's address is a
// JSON snapshot, not a row (ARCHITECTURE §3), so there is nothing for an id to point at.
export const AddressType = builder.objectRef<Address>("Address").implement({
  description: "Represents user address data.",
  fields: (t) => ({
    firstName: t.exposeString("firstName", { description: "The given name of the address." }),
    lastName: t.exposeString("lastName", { description: "The family name of the address." }),
    companyName: t.exposeString("companyName", { description: "Company or organization name." }),
    streetAddress1: t.exposeString("streetAddress1", {
      description: "The first line of the address.",
    }),
    streetAddress2: t.exposeString("streetAddress2", {
      description: "The second line of the address.",
    }),
    city: t.exposeString("city", { description: "The city of the address." }),
    cityArea: t.exposeString("cityArea", { description: "The district of the address." }),
    postalCode: t.exposeString("postalCode", { description: "The postal code of the address." }),
    country: t.field({
      type: CountryDisplay,
      description: "The country of the address.",
      resolve: (address) => address.country,
    }),
    countryArea: t.exposeString("countryArea", {
      description: "The country area of the address.",
    }),
    phone: t.string({
      nullable: true,
      description: "The phone number assigned the address.",
      resolve: (address) => address.phone || null,
    }),
  }),
});

const AddressInput = builder.inputType("AddressInput", {
  fields: (t) => ({
    firstName: t.string({ description: "Given name." }),
    lastName: t.string({ description: "Family name." }),
    companyName: t.string({ description: "Company or organization." }),
    streetAddress1: t.string({ description: "Address." }),
    streetAddress2: t.string({ description: "Address." }),
    city: t.string({ description: "City." }),
    cityArea: t.string({ description: "District." }),
    postalCode: t.string({ description: "Postal code." }),
    country: t.field({ type: CountryCodeEnum, description: "Country." }),
    countryArea: t.string({ description: "State or province." }),
    phone: t.string({ description: "Phone number." }),
  }),
});

// ---------------------------------------------------------------------------------------------
// Shipping methods

// Saleor's ShippingMethodType (staff) with the price and on/off switch on the method itself: we
// have no zones or channel listings (ARCHITECTURE §4 deviations).
export const ShippingMethodTypeType = builder.objectRef<ShippingMethodRow>("ShippingMethodType");

builder.node(ShippingMethodTypeType, {
  id: { resolve: (method) => method.id, description: "Shipping method ID." },
  description:
    "Shipping method are the methods you'll use to get customer's orders to them. They are " +
    "directly exposed to the customers.",
  fields: (t) => ({
    name: t.exposeString("name", { description: "Shipping method name." }),
    price: t.field({
      type: MoneyType,
      description: "The price of the shipping method.",
      resolve: (method) => toMoney(method.priceAmount, method.currency),
    }),
    isActive: t.exposeBoolean("isActive", {
      description: "Whether checkouts can choose this shipping method.",
    }),
  }),
});

// Saleor's ShippingMethod: the buyer's view of a method on a checkout.
export const ShippingMethodType = builder.objectRef<ShippingMethodRow>("ShippingMethod");

builder.node(ShippingMethodType, {
  id: {
    resolve: (method) => method.id,
    description: "Unique ID of ShippingMethod available for Order.",
  },
  description: "Shipping methods that can be used as means of shipping for orders and checkouts.",
  fields: (t) => ({
    name: t.exposeString("name", { description: "Shipping method name." }),
    price: t.field({
      type: MoneyType,
      description: "The price of selected shipping method.",
      resolve: (method) => toMoney(method.priceAmount, method.currency),
    }),
    active: t.boolean({
      description: "Describes if this shipping method is active and can be selected.",
      resolve: (method) => method.isActive,
    }),
    message: t.string({
      nullable: true,
      description: "Message connected to this shipping method.",
      resolve: () => null,
    }),
  }),
});

// Saleor's Delivery. We keep no per-checkout delivery rows, so its id is the shipping method's
// (ARCHITECTURE §4 deviations).
const DeliveryType = builder.objectRef<ShippingMethodRow>("Delivery").implement({
  description: "Represents a delivery method chosen for the checkout.",
  fields: (t) => ({
    id: t.id({
      description: "The ID of the delivery.",
      resolve: (method) => toGlobalId("ShippingMethod", method.id),
    }),
    shippingMethod: t.field({
      type: ShippingMethodType,
      nullable: true,
      description: "Shipping method represented by the delivery.",
      resolve: (method) => method,
    }),
  }),
});

builder.objectFields(CheckoutType, (t) => ({
  shippingAddress: t.field({
    type: AddressType,
    nullable: true,
    description: "The shipping address of the checkout.",
    resolve: (checkout) => parseStoredAddress(checkout.shippingAddress),
  }),
  billingAddress: t.field({
    type: AddressType,
    nullable: true,
    description: "The billing address of the checkout.",
    resolve: (checkout) => parseStoredAddress(checkout.billingAddress),
  }),
  shippingMethods: t.field({
    type: [ShippingMethodType],
    description: "Shipping methods that can be used with this checkout.",
    resolve: (_checkout, _args, ctx) => listActiveShippingMethods(ctx.db),
  }),
  delivery: t.field({
    type: DeliveryType,
    nullable: true,
    description: "The delivery method selected for this checkout.",
    resolve: (checkout, _args, ctx) => getCheckoutShippingMethod(ctx.db, checkout),
  }),
  shippingPrice: t.field({
    type: TaxedMoneyType,
    description: "The price of the shipping, with all the taxes included.",
    resolve: async (checkout, _args, ctx) =>
      (await ctx.checkoutLoaders.totalsByCheckoutId.load(checkout.id)).shipping,
  }),
}));

// ---------------------------------------------------------------------------------------------
// Staff: shipping method management (Saleor's shippingPrice* without a zone)

const ShippingErrorCode = builder.enumType("ShippingErrorCode", {
  values: ["INVALID", "NOT_FOUND", "REQUIRED"] as const,
});

const ShippingErrorType = builder
  .objectRef<{ field: string | null; code: ShippingError["code"] | "NOT_FOUND"; message: string }>(
    "ShippingError",
  )
  .implement({
    fields: (t) => ({
      field: t.exposeString("field", {
        nullable: true,
        description:
          "Name of a field that caused the error. A value of `null` indicates that the error " +
          "isn't associated with a particular field.",
      }),
      message: t.exposeString("message", { description: "The error message." }),
      code: t.field({
        type: ShippingErrorCode,
        description: "The error code.",
        resolve: (error) => error.code,
      }),
    }),
  });

const ShippingPriceInput = builder.inputType("ShippingPriceInput", {
  fields: (t) => ({
    name: t.string({ description: "Name of the shipping method." }),
    price: t.field({ type: Decimal, description: "The price of the shipping method." }),
    isActive: t.boolean({ description: "Whether checkouts can choose the shipping method." }),
  }),
});

type ShippingPayload = { shippingMethod: ShippingMethodRow | null; errors: ShippingError[] };

const shippingPayload = (name: string, description: string) =>
  builder.objectRef<ShippingPayload>(name).implement({
    description,
    fields: (t) => ({
      shippingMethod: t.field({
        type: ShippingMethodTypeType,
        nullable: true,
        resolve: (payload) => payload.shippingMethod,
      }),
      errors: t.field({ type: [ShippingErrorType], resolve: (payload) => payload.errors }),
    }),
  });

const CREATE_DESCRIPTION = `Creates a new shipping price.\n\n${MANAGE_SHIPPING}`;
const UPDATE_DESCRIPTION = `Updates a new shipping price.\n\n${MANAGE_SHIPPING}`;
const DELETE_DESCRIPTION = `Deletes a shipping price.\n\n${MANAGE_SHIPPING}`;

const ShippingPriceCreate = shippingPayload("ShippingPriceCreate", CREATE_DESCRIPTION);
const ShippingPriceUpdate = shippingPayload("ShippingPriceUpdate", UPDATE_DESCRIPTION);
const ShippingPriceDelete = shippingPayload("ShippingPriceDelete", DELETE_DESCRIPTION);

const toShippingPayload = (result: ShippingMethodResult): ShippingPayload =>
  result.ok
    ? { shippingMethod: result.shippingMethod, errors: [] }
    : { shippingMethod: null, errors: result.errors };

/** Unknown methods are Saleor's top-level node error, as in the other modules' mutations. */
async function runShippingWrite<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof ShippingMethodNotFoundError)) throw error;
    throw nodesNotFound(error.ids.map((id) => toGlobalId("ShippingMethodType", id)));
  }
}

builder.queryField("shippingMethods", (t) =>
  t.field({
    type: [ShippingMethodTypeType],
    description: `List of the shop's shipping methods, by name.\n\n${MANAGE_SHIPPING}`,
    resolve: async (_parent, _args, ctx) => {
      await requirePermission(ctx, "MANAGE_SHIPPING");
      return listShippingMethods(ctx.db);
    },
  }),
);

builder.mutationField("shippingPriceCreate", (t) =>
  t.field({
    type: ShippingPriceCreate,
    nullable: true,
    description: CREATE_DESCRIPTION,
    args: {
      input: t.arg({
        type: ShippingPriceInput,
        required: true,
        description: "Fields required to create a shipping price.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_SHIPPING");
      return toShippingPayload(await createShippingMethod(ctx.db, input));
    },
  }),
);

builder.mutationField("shippingPriceUpdate", (t) =>
  t.field({
    type: ShippingPriceUpdate,
    nullable: true,
    description: UPDATE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a shipping price to update." }),
      input: t.arg({
        type: ShippingPriceInput,
        required: true,
        description: "Fields required to update a shipping price.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_SHIPPING");
      const methodId = fromGlobalId("ShippingMethodType", String(id));
      return toShippingPayload(
        await runShippingWrite(() => updateShippingMethod(ctx.db, methodId, input)),
      );
    },
  }),
);

builder.mutationField("shippingPriceDelete", (t) =>
  t.field({
    type: ShippingPriceDelete,
    nullable: true,
    description: DELETE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a shipping price to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_SHIPPING");
      const methodId = fromGlobalId("ShippingMethodType", String(id));
      const shippingMethod = await runShippingWrite(() => deleteShippingMethod(ctx.db, methodId));
      return { shippingMethod, errors: [] };
    },
  }),
);

// ---------------------------------------------------------------------------------------------
// Buyer: checkout addresses and delivery method (public, by checkout id)

const CheckoutShippingAddressUpdate = checkoutLinesPayload("CheckoutShippingAddressUpdate");
const CheckoutBillingAddressUpdate = checkoutLinesPayload("CheckoutBillingAddressUpdate");
const CheckoutDeliveryMethodUpdate = checkoutLinesPayload("CheckoutDeliveryMethodUpdate");

const toAddressInput = (input: Record<string, string | null | undefined>): AddressInputData =>
  input as AddressInputData;

builder.mutationField("checkoutShippingAddressUpdate", (t) =>
  t.field({
    type: CheckoutShippingAddressUpdate,
    nullable: true,
    description: "Update shipping address in the existing checkout.",
    args: {
      id: t.arg.id({ required: true, description: "The checkout's ID." }),
      shippingAddress: t.arg({
        type: AddressInput,
        required: true,
        description: "The mailing address to where the checkout will be shipped.",
      }),
    },
    resolve: async (_parent, { id, shippingAddress }, ctx) => {
      const checkoutId = fromGlobalId("Checkout", String(id));
      return runCheckoutWrite(ctx, checkoutId, () =>
        updateCheckoutAddress(ctx.db, checkoutId, "SHIPPING", toAddressInput(shippingAddress)),
      );
    },
  }),
);

builder.mutationField("checkoutBillingAddressUpdate", (t) =>
  t.field({
    type: CheckoutBillingAddressUpdate,
    nullable: true,
    description: "Update billing address in the existing checkout.",
    args: {
      id: t.arg.id({ required: true, description: "The checkout's ID." }),
      billingAddress: t.arg({
        type: AddressInput,
        required: true,
        description: "The billing address of the checkout.",
      }),
    },
    resolve: async (_parent, { id, billingAddress }, ctx) => {
      const checkoutId = fromGlobalId("Checkout", String(id));
      return runCheckoutWrite(ctx, checkoutId, () =>
        updateCheckoutAddress(ctx.db, checkoutId, "BILLING", toAddressInput(billingAddress)),
      );
    },
  }),
);

builder.mutationField("checkoutDeliveryMethodUpdate", (t) =>
  t.field({
    type: CheckoutDeliveryMethodUpdate,
    nullable: true,
    description: "Updates the delivery method (shipping method) of the checkout.",
    args: {
      id: t.arg.id({ required: true, description: "The checkout's ID." }),
      deliveryMethodId: t.arg.id({ description: "Delivery Method ID (`ShippingMethod`)." }),
    },
    resolve: async (_parent, { id, deliveryMethodId }, ctx): Promise<CheckoutPayload> => {
      const checkoutId = fromGlobalId("Checkout", String(id));
      let methodId: string | null = null;
      if (deliveryMethodId != null) {
        // A malformed ID is the usual top-level error; another type is Saleor's INVALID.
        const decoded = decodeGlobalId(String(deliveryMethodId));
        if (decoded.typename !== "ShippingMethod") {
          return {
            checkout: null,
            errors: [
              {
                field: "deliveryMethodId",
                code: "INVALID",
                message: "ID does not belong to ShippingMethod.",
                variants: null,
                lines: null,
                addressType: null,
              },
            ],
          };
        }
        methodId = decoded.id;
      }
      return runCheckoutWrite(ctx, checkoutId, () =>
        updateCheckoutDeliveryMethod(ctx.db, checkoutId, methodId),
      );
    },
  }),
);
