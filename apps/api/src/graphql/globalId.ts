import { GraphQLError } from "graphql";

// Saleor's global IDs: base64("<Type>:<pk>") (graphene's Node.to_global_id). Our pks are UUIDs.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const toGlobalId = (type: string, id: string) =>
  Buffer.from(`${type}:${id}`).toString("base64");

/** Splits a global ID into its type name and pk; throws Saleor's error when it is malformed. */
export function decodeGlobalId(globalId: string): { typename: string; id: string } {
  const decoded = Buffer.from(globalId, "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  const id = decoded.slice(separator + 1);

  if (separator === -1 || !UUID.test(id)) {
    throw new GraphQLError(`Couldn't resolve id: ${globalId}.`);
  }

  return { typename: decoded.slice(0, separator), id };
}

/**
 * The pk inside a global ID of `type`. Throws Saleor's top-level errors for a malformed ID or one
 * of another type (saleor/graphql/core/utils/__init__.py from_global_id_or_error).
 */
export function fromGlobalId(type: string, globalId: string): string {
  const { typename: decodedType, id } = decodeGlobalId(globalId);
  if (decodedType !== type) {
    throw new GraphQLError(`Invalid ID: ${globalId}. Expected: ${type}, received: ${decodedType}.`);
  }
  return id;
}

/** Saleor's error for global IDs that are well-formed but match no row. */
export const nodesNotFound = (globalIds: string[]) =>
  new GraphQLError(
    `Could not resolve to a node with the global id list of '${JSON.stringify(globalIds)}'.`,
  );
