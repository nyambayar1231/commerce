import SchemaBuilder from "@pothos/core";
import RelayPlugin from "@pothos/plugin-relay";
import type { Context } from "./context.ts";
import { decodeGlobalId, toGlobalId } from "./globalId.ts";

// The one Pothos builder. Each module adds its types and fields in its own `graphql.ts`.
// Fields are non-null by default (`String!`), as in Saleor; nullable ones opt in with
// `nullable: true`.
//
// The Relay plugin gives Saleor's `Node` interface (each node type's `id` is a global ID) and,
// later, cursor connections. Saleor's schema has no `node` / `nodes` query, so neither do we.
// Global IDs keep Saleor's format, base64("<Type>:<pk>"), through our own encode/decode
// (graphql/globalId.ts), so malformed IDs get Saleor's error messages.
export const builder = new SchemaBuilder<{
  Context: Context;
  DefaultFieldNullability: false;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
    JSONString: { Input: unknown; Output: unknown };
  };
}>({
  plugins: [RelayPlugin],
  defaultFieldNullability: false,
  relay: {
    clientMutationId: "omit",
    cursorType: "String",
    nodeQueryOptions: false,
    nodesQueryOptions: false,
    nodeTypeOptions: { name: "Node" },
    idFieldOptions: { description: "The ID of the object." },
    encodeGlobalID: (typename, id) => toGlobalId(typename, String(id)),
    decodeGlobalID: (globalID) => decodeGlobalId(globalID),
  },
});

builder.queryType({});
builder.mutationType({});
