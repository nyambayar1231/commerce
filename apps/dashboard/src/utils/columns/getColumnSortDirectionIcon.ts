// Copied from saleor-dashboard: src/utils/columns/getColumnSortDirectionIcon.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
export interface Sort<T extends string = string> {
  asc?: boolean;
  sort?: T;
}

export function getColumnSortDirectionIcon<T extends string = string>(
  { sort, asc }: Sort<T>,
  columnName: T,
  options?: { nonSortableColumns?: T[] },
) {
  const nonSortableColumns = options?.nonSortableColumns ?? [];

  if (nonSortableColumns.includes(columnName)) {
    return undefined;
  }

  if (columnName === sort) {
    return asc ? "arrowUp" : "arrowDown";
  }

  return undefined;
}
