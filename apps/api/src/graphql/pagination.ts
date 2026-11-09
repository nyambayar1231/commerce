import {
  type FragmentDefinitionNode,
  GraphQLError,
  type GraphQLResolveInfo,
  Kind,
  type SelectionSetNode,
} from "graphql";

// Saleor's connection argument rules (saleor/graphql/core/connection.py,
// validate_slice_args): `first` or `last` is required, each at most 100 (Saleor's default
// GRAPHQL_PAGINATION_LIMIT), never negative. With both given, `first` wins, as in Saleor.
// Saleor only requires `first`/`last` when the query selects `edges` (_is_first_or_last_required);
// asking for `totalCount` alone needs neither.

export const PAGINATION_LIMIT = 100;

export interface PaginationArgs {
  first?: number | null;
  last?: number | null;
  after?: string | null;
  before?: string | null;
}

const selectsEdges = (
  selectionSet: SelectionSetNode | undefined,
  fragments: Record<string, FragmentDefinitionNode>,
): boolean =>
  (selectionSet?.selections ?? []).some((selection) => {
    if (selection.kind === Kind.FIELD) return selection.name.value === "edges";
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      return selectsEdges(selection.selectionSet, fragments);
    }
    return selectsEdges(fragments[selection.name.value]?.selectionSet, fragments);
  });

/** True when the resolving connection field's selection includes `edges`. */
export const isEdgesRequested = (info: GraphQLResolveInfo): boolean =>
  info.fieldNodes.some((node) => selectsEdges(node.selectionSet, info.fragments));

export function validatePagination(
  fieldName: string,
  args: PaginationArgs,
  edgesRequested = true,
): PaginationArgs {
  const { first, last } = args;

  if (!edgesRequested && !first && !last) {
    return { first: 0 };
  }

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
