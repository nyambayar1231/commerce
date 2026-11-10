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

const DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * Saleor's Decimal scalar (saleor/graphql/core/scalars.py): output as a number, input as a number
 * or a numeric string. The string is kept as typed, so no binary float rounding happens before the
 * currency conversion (`parseDecimal`); the numeric format is checked here, the currency's
 * exponent in the resolver that knows the shop currency.
 */
function parseDecimalValue(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new GraphQLError("Decimal must be a finite number.");
    return String(value);
  }
  if (typeof value === "string" && DECIMAL.test(value.trim())) return value.trim();
  throw new GraphQLError("Decimal must be a number or a numeric string.");
}

export const Decimal = builder.scalarType("Decimal", {
  description:
    "Custom Decimal implementation.\n\n" +
    "Returns Decimal as a float in the API,\n" +
    "parses float to the Decimal on the way back.",
  serialize: (value) => value,
  parseValue: parseDecimalValue,
  parseLiteral: (node) => {
    if (node.kind === Kind.INT || node.kind === Kind.FLOAT) return parseDecimalValue(node.value);
    if (node.kind === Kind.STRING) return parseDecimalValue(node.value);
    throw new GraphQLError("Decimal must be provided as a number or a numeric string.", {
      nodes: node,
    });
  },
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
