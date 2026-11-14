import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId } from "../../graphql/globalId.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import {
  type AddressInput as AddressInputData,
  type AddressType,
  cleanAddress,
  getShippingMethod,
} from "../checkout/index.ts";
import { AddressInput } from "../checkout/shippingGraphql.ts";
import { getActiveUserIdByEmail, getUsersByIds } from "../identity/index.ts";
import {
  createDraftOrder,
  type DraftOrderInput,
  deleteDraftOrder,
  type OrderError,
  updateDraftOrder,
} from "./index.ts";
import { type OrderPayloadData, orderPayload, toOrderError } from "./lifecycleGraphql.ts";

// Saleor's draftOrderCreate, draftOrderUpdate and draftOrderDelete
// (saleor/graphql/order/mutations/draft_order_*.py) for PLAN M13.2. The GraphQL layer composes the
// modules (ARCHITECTURE §2 rule 2): the checkout module cleans the addresses and owns the shipping
// methods, identity resolves the customer, and the orders module stores the result. Left out:
// lines on create (orderLinesCreate, M13.3), channels, vouchers, discounts, customer notes,
// redirect URLs, metadata, `save*Address` and the language code.

const MANAGE_ORDERS = "Requires one of the following permissions: MANAGE_ORDERS.";

const MESSAGES = {
  userNotFound: "Customer does not exist.",
  invalidEmail: "Enter a valid email address.",
  shippingNotFound: "Shipping method does not exist.",
  shippingInactive: "Shipping method is not applicable.",
} as const;

// Saleor's DraftOrderInput, without the fields listed above; DraftOrderCreateInput has the same
// fields (it gains `lines` in M13.3).
const draftOrderInputType = (name: string) =>
  builder.inputType(name, {
    fields: (t) => ({
      billingAddress: t.field({
        type: AddressInput,
        description: "Billing address of the customer.",
      }),
      shippingAddress: t.field({
        type: AddressInput,
        description: "Shipping address of the customer.",
      }),
      user: t.id({ description: "Customer associated with the draft order." }),
      userEmail: t.string({ description: "Email address of the customer." }),
      shippingMethod: t.id({ description: "ID of a selected shipping method." }),
    }),
  });

const DraftOrderInputType = draftOrderInputType("DraftOrderInput");
const DraftOrderCreateInputType = draftOrderInputType("DraftOrderCreateInput");

type DraftOrderGraphqlInput = {
  billingAddress?: Record<string, unknown> | null;
  shippingAddress?: Record<string, unknown> | null;
  user?: string | number | null;
  userEmail?: string | null;
  shippingMethod?: string | number | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Turns the GraphQL input into the orders module's DraftOrderInput, or Saleor-style errors. A field
 * left out of the input stays as it is; an explicit null clears it.
 */
async function cleanDraftInput(
  ctx: Context,
  input: DraftOrderGraphqlInput,
): Promise<{ ok: true; draft: DraftOrderInput } | { ok: false; errors: OrderError[] }> {
  const errors: OrderError[] = [];
  const draft: DraftOrderInput = {};

  // Saleor: `user` sets the account (its email goes with it); a bare `userEmail` links the active
  // account with that email, if any.
  if (input.user !== undefined) {
    if (input.user === null) {
      draft.customer = null;
    } else {
      const [user] = await getUsersByIds(ctx.db, [fromGlobalId("User", String(input.user))]);
      if (!user) errors.push({ field: "user", code: "NOT_FOUND", message: MESSAGES.userNotFound });
      else draft.customer = { userId: user.id, email: user.email };
    }
  } else if (input.userEmail !== undefined) {
    const email = input.userEmail?.trim() ?? "";
    if (email === "") {
      draft.customer = null;
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.push({ field: "userEmail", code: "INVALID", message: MESSAGES.invalidEmail });
    } else {
      draft.customer = { userId: await getActiveUserIdByEmail(ctx.db, email), email };
    }
  }

  const address = (value: Record<string, unknown> | null | undefined, type: AddressType) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const cleaned = cleanAddress(value as AddressInputData);
    if (cleaned.ok) return cleaned.address;
    for (const error of cleaned.errors) {
      errors.push({
        field: error.field,
        code: error.code,
        message: error.message,
        addressType: type,
      });
    }
    return undefined;
  };
  const shippingAddress = address(input.shippingAddress, "SHIPPING");
  const billingAddress = address(input.billingAddress, "BILLING");
  if (shippingAddress !== undefined) draft.shippingAddress = shippingAddress;
  if (billingAddress !== undefined) draft.billingAddress = billingAddress;

  if (input.shippingMethod !== undefined) {
    if (input.shippingMethod === null) {
      draft.shippingMethod = null;
    } else {
      const method = await getShippingMethod(
        ctx.db,
        fromGlobalId("ShippingMethod", String(input.shippingMethod)),
      );
      if (!method) {
        errors.push({
          field: "shippingMethod",
          code: "NOT_FOUND",
          message: MESSAGES.shippingNotFound,
        });
      } else if (!method.isActive) {
        errors.push({
          field: "shippingMethod",
          code: "SHIPPING_METHOD_NOT_APPLICABLE",
          message: MESSAGES.shippingInactive,
        });
      } else {
        draft.shippingMethod = {
          id: method.id,
          name: method.name,
          priceAmount: method.priceAmount,
        };
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, draft };
}

const failed = (errors: OrderError[]): OrderPayloadData => ({
  order: null,
  errors: errors.map(toOrderError),
});

const DraftOrderCreatePayload = orderPayload("DraftOrderCreate", "Created draft order.");
const DraftOrderUpdatePayload = orderPayload("DraftOrderUpdate", "Updated draft order.");
const DraftOrderDeletePayload = orderPayload("DraftOrderDelete", "Deleted draft order.");

builder.mutationField("draftOrderCreate", (t) =>
  t.field({
    type: DraftOrderCreatePayload,
    nullable: true,
    description: `Creates a new draft order.\n\n${MANAGE_ORDERS}`,
    args: {
      input: t.arg({
        type: DraftOrderCreateInputType,
        required: true,
        description: "Fields required to create an order.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      const cleaned = await cleanDraftInput(ctx, input as DraftOrderGraphqlInput);
      if (!cleaned.ok) return failed(cleaned.errors);
      const order = await createDraftOrder(ctx.db, {
        staffUserId: ctx.user?.id ?? null,
        draft: cleaned.draft,
      });
      return { order, errors: [] };
    },
  }),
);

builder.mutationField("draftOrderUpdate", (t) =>
  t.field({
    type: DraftOrderUpdatePayload,
    nullable: true,
    description: `Updates a draft order.\n\n${MANAGE_ORDERS}`,
    args: {
      id: t.arg.id({ required: true, description: "ID of a draft order to update." }),
      input: t.arg({
        type: DraftOrderInputType,
        required: true,
        description: "Fields required to update an order.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      const orderId = fromGlobalId("Order", String(id));
      const cleaned = await cleanDraftInput(ctx, input as DraftOrderGraphqlInput);
      if (!cleaned.ok) return failed(cleaned.errors);
      const result = await updateDraftOrder(ctx.db, { orderId, draft: cleaned.draft });
      return result.ok ? { order: result.order, errors: [] } : failed(result.errors);
    },
  }),
);

builder.mutationField("draftOrderDelete", (t) =>
  t.field({
    type: DraftOrderDeletePayload,
    nullable: true,
    description: `Deletes a draft order.\n\n${MANAGE_ORDERS}`,
    args: { id: t.arg.id({ required: true, description: "ID of a draft order to delete." }) },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      const result = await deleteDraftOrder(ctx.db, { orderId: fromGlobalId("Order", String(id)) });
      return result.ok ? { order: result.order, errors: [] } : failed(result.errors);
    },
  }),
);
