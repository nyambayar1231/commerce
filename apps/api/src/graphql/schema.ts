import { builder } from "./builder.ts";

// Importing a module's graphql.ts registers its types and fields on the builder.
import "../modules/catalog/graphql.ts";
import "../modules/catalog/mediaMutations.ts";
import "../modules/catalog/productGraphql.ts";
import "../modules/catalog/productMutations.ts";
import "../modules/checkout/graphql.ts";
import "../modules/checkout/shippingGraphql.ts";
import "../modules/checkout/paymentGraphql.ts";
import "../modules/payments/graphql.ts";
import "../modules/identity/graphql.ts";
import "../modules/inventory/graphql.ts";
import "../modules/shop/graphql.ts";

export const schema = builder.toSchema();
