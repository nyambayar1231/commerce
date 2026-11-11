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

// Saleor's UUID scalar (saleor/graphql/core/scalars.py): a string in canonical form. Checkout's
// `token` is the only user; the format check lives in graphql/globalId.ts when an ID is decoded.
export const UUID = builder.scalarType("UUID", {
  description:
    "Represents a Universally Unique Identifier (UUID) string, for example " +
    '"5e8bfb3c-3db5-4a8e-8d4e-1c6f6e2c1a2b".',
  serialize: (value) => {
    if (typeof value !== "string") throw new GraphQLError("UUID must be a string.");
    return value;
  },
  parseValue: (value) => {
    if (typeof value !== "string") throw new GraphQLError("UUID must be a string.");
    return value;
  },
  parseLiteral: (node) => {
    if (node.kind !== Kind.STRING) throw new GraphQLError("UUID must be a string.");
    return node.value;
  },
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

/**
 * A WHATWG `File` as the multipart parser yields it. Yoga's fetch implementation (whatwg-node)
 * brings its own `File` class, so `instanceof File` is not enough: check the File/Blob surface.
 */
function isFile(value: unknown): value is File {
  if (value instanceof File) return true;
  if (typeof value !== "object" || value === null) return false;
  const file = value as Partial<File>;
  return (
    typeof file.name === "string" &&
    typeof file.type === "string" &&
    typeof file.size === "number" &&
    typeof file.arrayBuffer === "function"
  );
}

/**
 * Saleor's Upload scalar (saleor/graphql/core/types/upload.py): a mutation variable whose value is
 * a file part of a multipart request (the graphql-multipart-request-spec). It is never a JSON
 * value, so literals and serialization are rejected; `parseValue` receives the file part.
 */
export const Upload = builder.scalarType("Upload", {
  description:
    "Variables of this type must be set to null in mutations. They will be replaced with a " +
    "filename from a following multipart part containing a binary file. " +
    "See: https://github.com/jaydenseric/graphql-multipart-request-spec.",
  serialize: () => {
    throw new GraphQLError("Upload can only be used as an input.");
  },
  parseValue: (value) => {
    if (!isFile(value)) {
      throw new GraphQLError("Upload must be a file in a multipart request.");
    }
    return value;
  },
  parseLiteral: () => {
    throw new GraphQLError("Upload must be provided as a multipart file.");
  },
});
