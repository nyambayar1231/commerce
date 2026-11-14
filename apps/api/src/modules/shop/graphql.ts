import { builder } from "../../graphql/builder.ts";
import { getShop, type Shop } from "./queries.ts";

// Saleor's `Shop` type (saleor/graphql/shop/types.py), reduced to what we have.
export const ShopType = builder.objectRef<Shop>("Shop").implement({
  description: "Represents a shop resource containing general shop data and configuration.",
  fields: (t) => ({
    name: t.exposeString("name", { description: "Shop's name." }),
    currency: t.exposeString("currency", {
      description: "The shop's single currency (ISO 4217). Saleor keeps this per channel.",
    }),
  }),
});

builder.queryField("shop", (t) =>
  t.field({
    type: ShopType,
    description: "Return information about the shop.",
    resolve: (_parent, _args, context) => getShop(context.db),
  }),
);
