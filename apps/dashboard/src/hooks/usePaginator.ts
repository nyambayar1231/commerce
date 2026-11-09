// Adapted from saleor-dashboard: src/hooks/usePaginator.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Cursor pagination through the URL: the query reads `after`/`before` from it, and the
// previous/next links swap the cursor while keeping the other params (search, sort).
import { useMemo } from "react";

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
}

export interface PaginationState {
  after?: string;
  before?: string;
  first?: number;
  last?: number;
}

export interface Pagination {
  after?: string;
  before?: string;
}

export function createPaginationState(
  paginateBy: number,
  queryString: Pagination,
): PaginationState {
  if (queryString.after) {
    return { after: queryString.after, first: paginateBy };
  }

  if (queryString.before) {
    return { before: queryString.before, last: paginateBy };
  }

  return { first: paginateBy };
}

interface UsePaginatorArgs {
  pageInfo: PageInfo | undefined;
  paginationState: PaginationState;
  /** The page's other URL params, kept in the previous/next links. */
  queryString: Record<string, string | boolean | undefined>;
}

const toQuery = (params: Record<string, string | boolean | undefined>): string =>
  `?${new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([key, value]) => [key, String(value)]),
  ).toString()}`;

export function usePaginator({ queryString, paginationState, pageInfo }: UsePaginatorArgs) {
  const newPageInfo = useMemo<PageInfo | undefined>(
    () =>
      pageInfo
        ? {
            ...pageInfo,
            hasNextPage: !!paginationState.before || pageInfo.hasNextPage,
            hasPreviousPage: !!paginationState.after || pageInfo.hasPreviousPage,
          }
        : undefined,
    [paginationState, pageInfo],
  );

  const nextHref = useMemo(() => {
    if (!newPageInfo?.hasNextPage || !pageInfo?.endCursor) {
      return undefined;
    }

    return toQuery({ ...queryString, after: pageInfo.endCursor, before: undefined });
  }, [pageInfo?.endCursor, newPageInfo?.hasNextPage, queryString]);

  const prevHref = useMemo(() => {
    if (!newPageInfo?.hasPreviousPage || !pageInfo?.startCursor) {
      return undefined;
    }

    return toQuery({ ...queryString, after: undefined, before: pageInfo.startCursor });
  }, [pageInfo?.startCursor, newPageInfo?.hasPreviousPage, queryString]);

  return {
    nextHref,
    prevHref,
    hasNextPage: newPageInfo?.hasNextPage ?? false,
    hasPreviousPage: newPageInfo?.hasPreviousPage ?? false,
  };
}
