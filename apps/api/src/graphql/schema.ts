import { builder } from "./builder.ts";

// Importing a module's graphql.ts registers its types and fields on the builder.
import "../modules/shop/graphql.ts";

export const schema = builder.toSchema();
