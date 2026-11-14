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
import { OrderEventType, OrderLineType, OrderType } from "./graphql.ts";
import {
  addDraftOrderLines,
  completeDraftOrder,
  createDraftOrder,
  type DraftOrderInput,
  deleteDraftOrder,
  deleteDraftOrderLine,
  getOrder,
  getOrderLinesByIds,
  type OrderError,
  type OrderLineRow,
  updateDraftOrder,
  updateDraftOrderLine,
} from "./index.ts";
import {
  OrderErrorType,
  type OrderPayloadData,
  orderPayload,
  toOrderError,
} from "./lifecycleGraphql.ts";

// Saleor's draftOrderCreate, draftOrderUpdate and draftOrderDelete
// (saleor/graphql/order/mutations/draft_order_*.py) for PLAN M13.2. The GraphQL layer composes the
// modules (ARCHITECTURE §2 rule 2): the checkout module cleans the addresses and owns the shipping
// methods, identity resolves the customer, and the orders module stores the result. The lines
// mutations (M13.3) edit drafts only (Saleor also edits unconfirmed orders). Left out: `lines` on
// draftOrderCreate (Saleor's dashboard creates an empty draft and adds lines), `price` overrides,
// channels, vouchers, discounts, customer notes,
// redirect URLs, metadata, `save*Address` and the language code.

const MANAGE_ORDERS = "Requires one of the following permissions: MANAGE_ORDERS.";

const MESSAGES = {
  userNotFound: "Customer does not exist.",
  invalidEmail: "Enter a valid email address.",
  shippingNotFound: "Shipping method does not exist.",
  shippingInactive: "Shipping method is not applicable.",
} as const;

// Saleor's DraftOrderInput, without the fields listed above; DraftOrderCreateInput has the same
// fields (no `lines`, see above).
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
const DraftOrderCompletePayload = orderPayload("DraftOrderComplete", "Completed order.");

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

builder.mutationField("draftOrderComplete", (t) =>
  t.field({
    type: DraftOrderCompletePayload,
    nullable: true,
    description: `Completes creating an order.\n\n${MANAGE_ORDERS}`,
    args: {
      id: t.arg.id({ required: true, description: "ID of the order that will be completed." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      const orderId = fromGlobalId("Order", String(id));
      // The checkout module owns shipping methods: read the draft's method as it is now.
      const draft = await getOrder(ctx.db, orderId);
      const method =
        draft?.shippingMethodId != null
          ? await getShippingMethod(ctx.db, draft.shippingMethodId)
          : null;
      const result = await completeDraftOrder(ctx.db, {
        orderId,
        userId: ctx.user?.id ?? null,
        shippingMethod: method
          ? {
              id: method.id,
              name: method.name,
              priceAmount: method.priceAmount,
              isActive: method.isActive,
            }
          : null,
      });
      ctx.orderLoaders.linesByOrderId.clearAll();
      return result.ok ? { order: result.order, errors: [] } : failed(result.errors);
    },
  }),
);

// ── Lines (M13.3) ──────────────────────────────────────────────────────────────────────────────

const OrderLineCreateInput = builder.inputType("OrderLineCreateInput", {
  fields: (t) => ({
    quantity: t.int({ required: true, description: "Number of variant items ordered." }),
    variantId: t.id({ required: true, description: "Product variant ID." }),
    forceNewLine: t.boolean({
      defaultValue: false,
      description:
        "Flag that allow force splitting the same variant into multiple lines by skipping the " +
        "matching logic.",
    }),
  }),
});

const OrderLineInput = builder.inputType("OrderLineInput", {
  fields: (t) => ({
    quantity: t.int({ required: true, description: "Number of variant items ordered." }),
  }),
});

const OrderLinesCreatePayload = builder
  .objectRef<OrderPayloadData & { orderLines: OrderLineRow[] | null }>("OrderLinesCreate")
  .implement({
    fields: (t) => ({
      order: t.field({
        type: OrderType,
        nullable: true,
        description: "Related order.",
        resolve: (p) => p.order,
      }),
      orderLines: t.field({
        type: [OrderLineType],
        nullable: true,
        description: "List of added order lines.",
        resolve: (p) => p.orderLines,
      }),
      errors: t.field({ type: [OrderErrorType], resolve: (p) => p.errors }),
    }),
  });

const orderLinePayload = (name: string, description: string) =>
  builder.objectRef<OrderPayloadData & { orderLine: OrderLineRow | null }>(name).implement({
    fields: (t) => ({
      order: t.field({
        type: OrderType,
        nullable: true,
        description: "A related order.",
        resolve: (p) => p.order,
      }),
      orderLine: t.field({
        type: OrderLineType,
        nullable: true,
        description,
        resolve: (p) => p.orderLine,
      }),
      errors: t.field({ type: [OrderErrorType], resolve: (p) => p.errors }),
    }),
  });

const OrderLineUpdatePayload = orderLinePayload("OrderLineUpdate", "An updated order line.");
const OrderLineDeletePayload = orderLinePayload(
  "OrderLineDelete",
  "An order line that was deleted.",
);

const lineFailed = (errors: OrderError[]) => ({
  order: null,
  orderLine: null,
  errors: errors.map(toOrderError),
});

builder.mutationField("orderLinesCreate", (t) =>
  t.field({
    type: OrderLinesCreatePayload,
    nullable: true,
    description: `Create order lines for a draft order.\n\n${MANAGE_ORDERS}`,
    args: {
      id: t.arg.id({ required: true, description: "ID of the order to add the lines to." }),
      input: t.arg({
        type: [OrderLineCreateInput],
        required: true,
        description: "Fields required to add order lines.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      const result = await addDraftOrderLines(ctx.db, {
        orderId: fromGlobalId("Order", String(id)),
        userId: ctx.user?.id ?? null,
        lines: input.map((line) => ({
          variantId: fromGlobalId("ProductVariant", String(line.variantId)),
          quantity: line.quantity,
          forceNewLine: line.forceNewLine ?? false,
        })),
      });
      ctx.orderLoaders.linesByOrderId.clearAll();
      return result.ok
        ? { order: result.order, orderLines: result.lines, errors: [] }
        : { order: null, orderLines: null, errors: result.errors.map(toOrderError) };
    },
  }),
);

builder.mutationField("orderLineUpdate", (t) =>
  t.field({
    type: OrderLineUpdatePayload,
    nullable: true,
    description: `Updates an order line of a draft order.\n\n${MANAGE_ORDERS}`,
    args: {
      id: t.arg.id({ required: true, description: "ID of the order line to update." }),
      input: t.arg({
        type: OrderLineInput,
        required: true,
        description: "Fields required to update an order line.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      const result = await updateDraftOrderLine(ctx.db, {
        lineId: fromGlobalId("OrderLine", String(id)),
        userId: ctx.user?.id ?? null,
        quantity: input.quantity,
      });
      ctx.orderLoaders.linesByOrderId.clearAll();
      return result.ok
        ? { order: result.order, orderLine: result.line, errors: [] }
        : lineFailed(result.errors);
    },
  }),
);

builder.mutationField("orderLineDelete", (t) =>
  t.field({
    type: OrderLineDeletePayload,
    nullable: true,
    description: `Deletes an order line from a draft order.\n\n${MANAGE_ORDERS}`,
    args: { id: t.arg.id({ required: true, description: "ID of the order line to delete." }) },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      const result = await deleteDraftOrderLine(ctx.db, {
        lineId: fromGlobalId("OrderLine", String(id)),
        userId: ctx.user?.id ?? null,
      });
      ctx.orderLoaders.linesByOrderId.clearAll();
      return result.ok
        ? { order: result.order, orderLine: result.line, errors: [] }
        : lineFailed(result.errors);
    },
  }),
);

// Saleor's OrderEventOrderLineObject: the lines an ADDED_PRODUCTS / REMOVED_PRODUCTS event names.
type EventLineData = { lineId: string; itemName: string; quantity: number };

const OrderEventOrderLineObject = builder
  .objectRef<EventLineData>("OrderEventOrderLineObject")
  .implement({
    fields: (t) => ({
      quantity: t.exposeInt("quantity", { nullable: true, description: "The variant quantity." }),
      itemName: t.exposeString("itemName", { nullable: true, description: "The variant name." }),
      orderLine: t.field({
        type: OrderLineType,
        nullable: true,
        description: "The order line (null once it was removed).",
        resolve: async (line, _args, ctx) =>
          (await getOrderLinesByIds(ctx.db, [line.lineId]))[0] ?? null,
      }),
    }),
  });

builder.objectField(OrderEventType, "lines", (t) =>
  t.field({
    type: [OrderEventOrderLineObject],
    nullable: true,
    description: "The concerned lines.",
    resolve: (event) => {
      const lines = (event.payload as { lines?: unknown } | null)?.lines;
      if (!Array.isArray(lines)) return null;
      return lines.filter(
        (line): line is EventLineData =>
          typeof line === "object" &&
          line !== null &&
          typeof (line as EventLineData).lineId === "string" &&
          typeof (line as EventLineData).itemName === "string" &&
          typeof (line as EventLineData).quantity === "number",
      );
    },
  }),
);
