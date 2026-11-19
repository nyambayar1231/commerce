import { type GraphQLScalarType, Kind, type StringValueNode } from "graphql";
import { describe, expect, it } from "vitest";
import { schema } from "./schema.ts";

// The scalar as the server serves it (the same object Yoga coerces variables and literals with).
const UUID = schema.getType("UUID") as GraphQLScalarType;

const stringLiteral = (value: string): StringValueNode => ({ kind: Kind.STRING, value });

// graphql-js passes the variable values as the second argument to the deprecated `parseLiteral`.
const parseLiteral = (value: string) => UUID.parseLiteral(stringLiteral(value), undefined);

describe("UUID scalar", () => {
  it("accepts a canonical UUID and returns it lower-cased", () => {
    const lower = "5e8bfb3c-3db5-4a8e-8d4e-1c6f6e2c1a2b";
    expect(UUID.parseValue(lower)).toBe(lower);
    expect(UUID.parseValue(lower.toUpperCase())).toBe(lower);
    expect(parseLiteral(lower.toUpperCase())).toBe(lower);
  });

  it("rejects a string that is not a canonical UUID, naming the value", () => {
    const malformed = [
      "not-a-uuid",
      "",
      "5e8bfb3c3db54a8e8d4e1c6f6e2c1a2b", // no dashes
      "5e8bfb3c-3db5-4a8e-8d4e-1c6f6e2c1a2g", // "g" is not hex
      "5e8bfb3c-3db5-4a8e-8d4e-1c6f6e2c1a2", // one digit short
      "5e8bfb3c-3db5-4a8e-8d4e-1c6f6e2c1a2bb", // one digit long
    ];
    for (const value of malformed) {
      expect(() => UUID.parseValue(value)).toThrow(`${value} is not a valid UUID.`);
      expect(() => parseLiteral(value)).toThrow(`${value} is not a valid UUID.`);
    }
  });

  it("rejects a value that is not a string", () => {
    expect(() => UUID.parseValue(42)).toThrow("UUID must be a string.");
    expect(() => UUID.parseLiteral({ kind: Kind.INT, value: "42" }, undefined)).toThrow(
      "UUID must be a string.",
    );
  });

  it("serializes a string unchanged", () => {
    expect(UUID.serialize("5E8BFB3C-3DB5-4A8E-8D4E-1C6F6E2C1A2B")).toBe(
      "5E8BFB3C-3DB5-4A8E-8D4E-1C6F6E2C1A2B",
    );
  });
});
