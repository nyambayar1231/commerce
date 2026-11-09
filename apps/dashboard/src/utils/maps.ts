// Adapted from saleor-dashboard: src/utils/maps.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only mapEdgesToItems so far.

interface Connection<T> {
  edges: { node: T }[];
}

export function mapEdgesToItems<T>(data: Connection<T> | undefined | null): T[] | undefined {
  return data?.edges?.map(({ node }) => node);
}
