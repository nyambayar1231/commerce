import { GraphQLError, Kind, type ValueNode } from "graphql";
import { builder } from "./builder.ts";

function parseDateTime(value: unknown): Date {
  if (typeof value !== "string") throw new GraphQLError("DateTime must be an ISO-8601 string.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new GraphQLError("Invalid DateTime.");
  return date;
}

function stringLiteral(node: ValueNode, scalar: string): string {
  if (node.kind !== Kind.STRING) {
    throw new GraphQLError(`${scalar} must be provided as a string.`, { nodes: node });
  }
  return node.value;
}

export const DateTime = builder.scalarType("DateTime", {
  description:
    "The `DateTime` scalar type represents a DateTime\n" +
    "value as specified by\n" +
    "[iso8601](https://en.wikipedia.org/wiki/ISO_8601).",
  serialize: (date) => date.toISOString(),
  parseValue: parseDateTime,
  parseLiteral: (node) => parseDateTime(stringLiteral(node, "DateTime")),
});

function parseJSON(value: unknown): unknown {
  if (typeof value !== "string") throw new GraphQLError("Unable to parse JSON string.");
  try {
    return JSON.parse(value);
  } catch {
    throw new GraphQLError("Unable to parse JSON string.");
  }
}

// A JSON document inside a string, like Saleor's JSONString (not an arbitrary JSON AST).
export const JSONString = builder.scalarType("JSONString", {
  serialize: (value) => JSON.stringify(value),
  parseValue: parseJSON,
  parseLiteral: (node) => parseJSON(stringLiteral(node, "JSONString")),
});
