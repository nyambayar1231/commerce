import { builder } from "../../graphql/builder.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { JSONString } from "../../graphql/scalars.ts";
import { OrderType } from "../orders/graphql.ts";
import type { OrderRow } from "../orders/index.ts";
import { completeCheckout } from "./complete.ts";
import { type CheckoutErrorData, CheckoutErrorType, toGraphqlError } from "./graphql.ts";
import { CheckoutNotFoundError, getCheckout, parseStoredAddress } from "./index.ts";
import { AddressType } from "./shippingGraphql.ts";

// Saleor's checkoutComplete (saleor/graphql/checkout/mutations/checkout_complete.py) over
// completeCheckout (ARCHITECTURE §5.4). The checkout module also adds the order's addresses (it
// owns the Address type) and the order's `checkoutId`. Public, like the rest of checkout.

builder.objectFields(OrderType, (t) => ({
  billingAddress: t.field({
    type: AddressType,
    nullable: true,
    description: "Billing address: the checkout's, copied at completion.",
    resolve: (order) => parseStoredAddress(order.billingAddress),
  }),
  shippingAddress: t.field({
    type: AddressType,
    nullable: true,
    description: "Shipping address: the checkout's, copied at completion.",
    resolve: (order) => parseStoredAddress(order.shippingAddress),
  }),
}));

type CheckoutCompletePayload = { order: OrderRow | null; errors: CheckoutErrorData[] };

const CheckoutComplete = builder.objectRef<CheckoutCompletePayload>("CheckoutComplete").implement({
  description:
    "Completes the checkout. As a result a new order is created. The mutation allows to create " +
    "the unpaid order when setting `orderSettings.allowUnpaidOrders` for given `Channel` is set " +
    "to `true`.",
  fields: (t) => ({
    order: t.field({
      type: OrderType,
      nullable: true,
      description: "Placed order.",
      resolve: (payload) => payload.order,
    }),
    confirmationNeeded: t.boolean({
      description: "Set to true if payment needs to be confirmed before checkout is complete.",
      resolve: () => false,
    }),
    confirmationData: t.field({
      type: JSONString,
      nullable: true,
      description: "Confirmation data used to process additional authorization steps.",
      resolve: () => null,
    }),
    errors: t.field({ type: [CheckoutErrorType], resolve: (payload) => payload.errors }),
  }),
});

builder.mutationField("checkoutComplete", (t) =>
  t.field({
    type: CheckoutComplete,
    nullable: true,
    description:
      "Completes the checkout. As a result a new order is created. The checkout must be fully " +
      "covered by its transactions (`authorizeStatus` FULL). Completing an already completed " +
      "checkout returns its order.",
    args: {
      id: t.arg.id({ required: true, description: "The checkout's ID." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      const checkoutId = fromGlobalId("Checkout", String(id));
      try {
        const result = await completeCheckout(ctx.db, checkoutId);
        if (!result.ok) return { order: null, errors: result.errors.map(toGraphqlError) };
        // Transactions moved to the order; the checkout's cached reads are stale.
        ctx.paymentLoaders.transactionsByCheckoutId.clear(checkoutId);
        return { order: result.order, errors: [] };
      } catch (error) {
        if (!(error instanceof CheckoutNotFoundError)) throw error;
        throw nodesNotFound(error.ids.map((unknown) => toGlobalId("Checkout", unknown)));
      }
    },
  }),
);

builder.objectField(OrderType, "checkoutId", (t) =>
  t.id({
    nullable: true,
    description: "ID of the checkout that the order was created from.",
    resolve: async (order, _args, ctx) => {
      if (order.checkoutToken === null) return null;
      const checkout = await getCheckout(ctx.db, order.checkoutToken);
      return checkout ? toGlobalId("Checkout", checkout.id) : null;
    },
  }),
);
