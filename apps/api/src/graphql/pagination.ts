import { GraphQLError } from "graphql";

// Saleor's connection argument rules (saleor/graphql/core/connection.py,
// validate_slice_args): `first` or `last` is required, each at most 100 (Saleor's default
// GRAPHQL_PAGINATION_LIMIT), never negative. With both given, `first` wins, as in Saleor.

export const PAGINATION_LIMIT = 100;

export interface PaginationArgs {
  first?: number | null;
  last?: number | null;
  after?: string | null;
  before?: string | null;
}

export function validatePagination(fieldName: string, args: PaginationArgs): PaginationArgs {
  const { first, last } = args;

  if (!first && !last) {
    throw new GraphQLError(
      `You must provide a \`first\` or \`last\` value to properly paginate the \`${fieldName}\` connection.`,
    );
  }
  for (const [name, value] of [
    ["first", first],
    ["last", last],
  ] as const) {
    if (value != null && value < 0) {
      throw new GraphQLError(`Argument "${name}" must be a non-negative integer`);
    }
    if (value != null && value > PAGINATION_LIMIT) {
      throw new GraphQLError(
        `Requesting ${value} records on the \`${fieldName}\` connection exceeds the \`${name}\` limit of ${PAGINATION_LIMIT} records.`,
      );
    }
  }

  return first ? { first, after: args.after } : { last, before: args.before };
}
