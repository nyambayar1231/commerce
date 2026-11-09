import SchemaBuilder from "@pothos/core";
import type { Context } from "./context.ts";

// The one Pothos builder. Each module adds its types and fields in its own `graphql.ts`.
// Fields are non-null by default (`String!`), as in Saleor; nullable ones opt in with
// `nullable: true`.
export const builder = new SchemaBuilder<{
  Context: Context;
  DefaultFieldNullability: false;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
    JSONString: { Input: unknown; Output: unknown };
  };
}>({
  defaultFieldNullability: false,
});

builder.queryType({});
builder.mutationType({});
