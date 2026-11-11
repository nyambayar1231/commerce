import { multiplyMoney } from "@commerce/contracts";
import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { MoneyType, TaxedMoneyType } from "../../graphql/money.ts";
import { DateTime, UUID } from "../../graphql/scalars.ts";
import { toMoney } from "../catalog/index.ts";
import { ProductVariantType } from "../catalog/productGraphql.ts";
import {
  addCheckoutLines,
  type CheckoutError,
  type CheckoutLineInput as CheckoutLineInputData,
  type CheckoutLineQuantityInput,
  type CheckoutLineRow,
  CheckoutNotFoundError,
  type CheckoutResult,
  type CheckoutRow,
  createCheckout,
  deleteCheckoutLines,
  getCheckout,
  taxedMoney,
  updateCheckoutEmail,
  updateCheckoutLines,
} from "./index.ts";

// GraphQL layer for Saleor's checkout cart mutations (saleor/graphql/checkout/). All public: a
// buyer uses a checkout by holding its id (PLAN M5 decision 5). Resolvers only decode global IDs,
// call the module's functions and map their results.

export const CheckoutType = builder.objectRef<CheckoutRow>("Checkout");
export const CheckoutLineType = builder.objectRef<CheckoutLineRow>("CheckoutLine");

builder.node(CheckoutType, {
  id: { resolve: (checkout) => checkout.id, description: "The ID of the checkout." },
  fields: (t) => ({
    token: t.field({
      type: UUID,
      description: "The checkout's token.",
      resolve: (checkout) => checkout.id,
    }),
    email: t.exposeString("email", {
      nullable: true,
      description: "Email of a customer.",
    }),
    created: t.field({
      type: DateTime,
      description: "The date and time when the checkout was created.",
      resolve: (checkout) => checkout.createdAt,
    }),
    updatedAt: t.field({
      type: DateTime,
      description: "Time of last modification of the given checkout.",
      resolve: (checkout) => checkout.updatedAt,
    }),
    isShippingRequired: t.boolean({
      description: "Returns True, if checkout requires shipping.",
      resolve: () => true,
    }),
    quantity: t.int({
      description: "The number of items purchased.",
      resolve: async (checkout, _args, ctx) => {
        const lines = await ctx.checkoutLoaders.linesByCheckoutId.load(checkout.id);
        return lines.reduce((total, line) => total + line.quantity, 0);
      },
    }),
    lines: t.field({
      type: [CheckoutLineType],
      description:
        "A list of checkout lines, each containing information about an item in the checkout.",
      resolve: (checkout, _args, ctx) => ctx.checkoutLoaders.linesByCheckoutId.load(checkout.id),
    }),
    subtotalPrice: t.field({
      type: TaxedMoneyType,
      description: "The price of the checkout before shipping, with taxes included.",
      resolve: async (checkout, _args, ctx) =>
        (await ctx.checkoutLoaders.totalsByCheckoutId.load(checkout.id)).subtotal,
    }),
    totalPrice: t.field({
      type: TaxedMoneyType,
      description:
        "The sum of the checkout line prices, with all the taxes, shipping costs, and " +
        "discounts included.",
      resolve: async (checkout, _args, ctx) =>
        (await ctx.checkoutLoaders.totalsByCheckoutId.load(checkout.id)).total,
    }),
  }),
});

/** A line's variant, through the request's batched variant loader. */
async function lineVariant(ctx: Context, line: CheckoutLineRow) {
  const variant = await ctx.checkoutLoaders.variantById.load(line.variantId);
  if (!variant) throw new GraphQLError("Product variant not found.");
  return variant;
}

/** Saleor's live line prices: the variant's current price times the line quantity (§5.2). */
async function linePrices(ctx: Context, line: CheckoutLineRow) {
  const variant = await lineVariant(ctx, line);
  const unitPrice = toMoney(variant.priceAmount, variant.currency);
  return { unitPrice, totalPrice: multiplyMoney(unitPrice, line.quantity) };
}

builder.node(CheckoutLineType, {
  id: { resolve: (line) => line.id, description: "The ID of the checkout line." },
  fields: (t) => ({
    variant: t.field({
      type: ProductVariantType,
      description: "The product variant from which the checkout line was created.",
      resolve: (line, _args, ctx) => lineVariant(ctx, line),
    }),
    quantity: t.exposeInt("quantity", {
      description: "The quantity of product variant assigned to the checkout line.",
    }),
    unitPrice: t.field({
      type: TaxedMoneyType,
      description: "The unit price of the checkout line, with taxes and discounts.",
      resolve: async (line, _args, ctx) => taxedMoney((await linePrices(ctx, line)).unitPrice),
    }),
    undiscountedUnitPrice: t.field({
      type: MoneyType,
      description: "The unit price of the checkout line, without discounts.",
      resolve: async (line, _args, ctx) => (await linePrices(ctx, line)).unitPrice,
    }),
    totalPrice: t.field({
      type: TaxedMoneyType,
      description: "The sum of the checkout line price, taxes and discounts.",
      resolve: async (line, _args, ctx) => taxedMoney((await linePrices(ctx, line)).totalPrice),
    }),
    undiscountedTotalPrice: t.field({
      type: MoneyType,
      description: "The sum of the checkout line price, without discounts.",
      resolve: async (line, _args, ctx) => (await linePrices(ctx, line)).totalPrice,
    }),
    requiresShipping: t.boolean({
      description: "Indicates whether the item need to be delivered.",
      resolve: () => true,
    }),
  }),
});

// Saleor's CheckoutErrorCode values our payloads can return. The domain functions return only
// these, so the enum lists only these; a new one is added with the feature that can return it.
const CheckoutErrorCode = builder.enumType("CheckoutErrorCode", {
  values: [
    "BILLING_ADDRESS_NOT_SET",
    "CHECKOUT_NOT_FULLY_PAID",
    "DELIVERY_METHOD_NOT_APPLICABLE",
    "EMAIL_NOT_SET",
    "INSUFFICIENT_STOCK",
    "INVALID",
    "INVALID_SHIPPING_METHOD",
    "NO_LINES",
    "NOT_FOUND",
    "PRODUCT_NOT_PUBLISHED",
    "QUANTITY_GREATER_THAN_LIMIT",
    "REQUIRED",
    "SHIPPING_ADDRESS_NOT_SET",
    "SHIPPING_METHOD_NOT_SET",
    "ZERO_QUANTITY",
  ] as const,
});

type CheckoutErrorCodeValue = (typeof CheckoutErrorCode)["$inferType"];

// Saleor's AddressTypeEnum: which of the checkout's addresses an error belongs to.
export const AddressTypeEnum = builder.enumType("AddressTypeEnum", {
  values: ["BILLING", "SHIPPING"] as const,
});

export type CheckoutErrorData = {
  field: string | null;
  message: string;
  code: CheckoutErrorCodeValue;
  variants: string[] | null;
  lines: string[] | null;
  addressType: "BILLING" | "SHIPPING" | null;
};

export const CheckoutErrorType = builder.objectRef<CheckoutErrorData>("CheckoutError").implement({
  fields: (t) => ({
    field: t.exposeString("field", {
      nullable: true,
      description:
        "Name of a field that caused the error. A value of `null` indicates that the error " +
        "isn't associated with a particular field.",
    }),
    message: t.exposeString("message", { description: "The error message." }),
    code: t.field({
      type: CheckoutErrorCode,
      description: "The error code.",
      resolve: (error) => error.code,
    }),
    variants: t.idList({
      nullable: true,
      description: "List of variant IDs which causes the error.",
      resolve: (error) => error.variants,
    }),
    lines: t.idList({
      nullable: true,
      description: "List of line Ids which cause the error.",
      resolve: (error) => error.lines,
    }),
    addressType: t.field({
      type: AddressTypeEnum,
      nullable: true,
      description: "A type of address that causes the error.",
      resolve: (error) => error.addressType,
    }),
  }),
});

/** Domain errors carry primary keys; the API exposes global IDs. */
export const toGraphqlError = (error: CheckoutError): CheckoutErrorData => ({
  field: error.field,
  message: error.message,
  code: error.code,
  variants: error.variants?.map((id) => toGlobalId("ProductVariant", id)) ?? null,
  lines: error.lines?.map((id) => toGlobalId("CheckoutLine", id)) ?? null,
  addressType: error.addressType ?? null,
});

export type CheckoutPayload = { checkout: CheckoutRow | null; errors: CheckoutErrorData[] };
type CheckoutCreatePayloadData = CheckoutPayload & { created: boolean };

const CheckoutCreatePayload = builder
  .objectRef<CheckoutCreatePayloadData>("CheckoutCreate")
  .implement({
    fields: (t) => ({
      created: t.exposeBoolean("created", {
        nullable: true,
        description:
          "Whether the checkout was created or the current active one was returned. Refer to " +
          "checkoutLinesAdd and checkoutLinesUpdate to merge a cart with an active checkout.",
      }),
      checkout: t.field({
        type: CheckoutType,
        nullable: true,
        description: "The created checkout.",
        resolve: (payload) => payload.checkout,
      }),
      errors: t.field({ type: [CheckoutErrorType], resolve: (payload) => payload.errors }),
    }),
  });

export const checkoutLinesPayload = (name: string) =>
  builder.objectRef<CheckoutPayload>(name).implement({
    fields: (t) => ({
      checkout: t.field({
        type: CheckoutType,
        nullable: true,
        description: "An updated checkout.",
        resolve: (payload) => payload.checkout,
      }),
      errors: t.field({ type: [CheckoutErrorType], resolve: (payload) => payload.errors }),
    }),
  });

const CheckoutLinesAdd = checkoutLinesPayload("CheckoutLinesAdd");
const CheckoutLinesUpdate = checkoutLinesPayload("CheckoutLinesUpdate");
const CheckoutLinesDelete = checkoutLinesPayload("CheckoutLinesDelete");
const CheckoutEmailUpdate = checkoutLinesPayload("CheckoutEmailUpdate");

const CheckoutLineInput = builder.inputType("CheckoutLineInput", {
  fields: (t) => ({
    quantity: t.int({ required: true, description: "The number of items purchased." }),
    variantId: t.id({ required: true, description: "ID of the product variant." }),
  }),
});

const CheckoutCreateInput = builder.inputType("CheckoutCreateInput", {
  fields: (t) => ({
    lines: t.field({
      type: [CheckoutLineInput],
      required: true,
      description:
        "A list of checkout lines, each containing information about an item in the checkout.",
    }),
    email: t.string({ description: "The customer's email address." }),
  }),
});

const CheckoutLineUpdateInput = builder.inputType("CheckoutLineUpdateInput", {
  fields: (t) => ({
    lineId: t.id({ required: true, description: "ID of the line." }),
    quantity: t.int({ required: true, description: "The number of items purchased." }),
  }),
});

/** Input global IDs are decoded to primary keys; a malformed ID is the usual top-level error. */
function decodeLineInputs(
  lines: readonly { variantId: string; quantity: number }[],
): CheckoutLineInputData[] {
  return lines.map((line) => ({
    variantId: fromGlobalId("ProductVariant", String(line.variantId)),
    quantity: line.quantity,
  }));
}

function decodeLineQuantities(
  lines: readonly { lineId: string; quantity: number }[],
): CheckoutLineQuantityInput[] {
  return lines.map((line) => ({
    lineId: fromGlobalId("CheckoutLine", String(line.lineId)),
    quantity: line.quantity,
  }));
}

/** A payload for a write's result; the request's loaders are cleared so the payload reads fresh. */
function checkoutPayload(
  ctx: Context,
  checkoutId: string,
  result: CheckoutResult,
): CheckoutPayload {
  if (!result.ok) return { checkout: null, errors: result.errors.map(toGraphqlError) };
  ctx.checkoutLoaders.linesByCheckoutId.clear(checkoutId);
  ctx.checkoutLoaders.totalsByCheckoutId.clear(checkoutId);
  return { checkout: result.checkout, errors: [] };
}

/** Unknown checkout ids are Saleor's top-level node error, as in the other modules' mutations. */
export async function runCheckoutWrite(
  ctx: Context,
  checkoutId: string,
  call: () => Promise<CheckoutResult>,
): Promise<CheckoutPayload> {
  try {
    return checkoutPayload(ctx, checkoutId, await call());
  } catch (error) {
    if (!(error instanceof CheckoutNotFoundError)) throw error;
    throw nodesNotFound(error.ids.map((id) => toGlobalId("Checkout", id)));
  }
}

builder.queryField("checkout", (t) =>
  t.field({
    type: CheckoutType,
    nullable: true,
    description: "Look up a checkout by id.",
    args: {
      id: t.arg.id({ description: "The checkout's ID." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      if (id == null) return null;
      // A malformed ID is a top-level error (fromGlobalId); a well-formed unknown one is null.
      return getCheckout(ctx.db, fromGlobalId("Checkout", String(id)));
    },
  }),
);

builder.mutationField("checkoutCreate", (t) =>
  t.field({
    type: CheckoutCreatePayload,
    nullable: true,
    description: "Creates a new checkout.",
    args: {
      input: t.arg({
        type: CheckoutCreateInput,
        required: true,
        description: "Fields required to create checkout.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      const result = await createCheckout(ctx.db, {
        email: input.email,
        lines: decodeLineInputs(input.lines),
      });
      return {
        created: true,
        checkout: result.ok ? result.checkout : null,
        errors: result.ok ? [] : result.errors.map(toGraphqlError),
      };
    },
  }),
);

builder.mutationField("checkoutLinesAdd", (t) =>
  t.field({
    type: CheckoutLinesAdd,
    nullable: true,
    description:
      "Adds a checkout line to the existing checkout.If line was already in checkout, its " +
      "quantity will be increased.",
    args: {
      id: t.arg.id({ required: true, description: "The checkout's ID." }),
      lines: t.arg({
        type: [CheckoutLineInput],
        required: true,
        description:
          "A list of checkout lines, each containing information about an item in the checkout.",
      }),
    },
    resolve: async (_parent, { id, lines }, ctx) => {
      const checkoutId = fromGlobalId("Checkout", String(id));
      const decoded = decodeLineInputs(lines);
      return runCheckoutWrite(ctx, checkoutId, () => addCheckoutLines(ctx.db, checkoutId, decoded));
    },
  }),
);

builder.mutationField("checkoutLinesUpdate", (t) =>
  t.field({
    type: CheckoutLinesUpdate,
    nullable: true,
    description: "Updates checkout line in the existing checkout.",
    args: {
      id: t.arg.id({ required: true, description: "The checkout's ID." }),
      lines: t.arg({
        type: [CheckoutLineUpdateInput],
        required: true,
        description:
          "A list of checkout lines, each containing information about an item in the checkout.",
      }),
    },
    resolve: async (_parent, { id, lines }, ctx) => {
      const checkoutId = fromGlobalId("Checkout", String(id));
      const decoded = decodeLineQuantities(lines);
      return runCheckoutWrite(ctx, checkoutId, () =>
        updateCheckoutLines(ctx.db, checkoutId, decoded),
      );
    },
  }),
);

builder.mutationField("checkoutLinesDelete", (t) =>
  t.field({
    type: CheckoutLinesDelete,
    nullable: true,
    description: "Deletes checkout lines.",
    args: {
      id: t.arg.id({ required: true, description: "The checkout's ID." }),
      linesIds: t.arg.idList({ required: true, description: "A list of checkout lines." }),
    },
    resolve: async (_parent, { id, linesIds }, ctx) => {
      const checkoutId = fromGlobalId("Checkout", String(id));
      const lineIds = (linesIds ?? []).map((lineId) =>
        fromGlobalId("CheckoutLine", String(lineId)),
      );
      return runCheckoutWrite(ctx, checkoutId, () =>
        deleteCheckoutLines(ctx.db, checkoutId, lineIds),
      );
    },
  }),
);

builder.mutationField("checkoutEmailUpdate", (t) =>
  t.field({
    type: CheckoutEmailUpdate,
    nullable: true,
    description: "Updates email address in the existing checkout object.",
    args: {
      id: t.arg.id({ required: true, description: "The checkout's ID." }),
      email: t.arg.string({ required: true, description: "email." }),
    },
    resolve: async (_parent, { id, email }, ctx) => {
      const checkoutId = fromGlobalId("Checkout", String(id));
      return runCheckoutWrite(ctx, checkoutId, () =>
        updateCheckoutEmail(ctx.db, checkoutId, email),
      );
    },
  }),
);
