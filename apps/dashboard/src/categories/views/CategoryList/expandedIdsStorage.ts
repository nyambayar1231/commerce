// Adapted from saleor-dashboard: src/categories/views/CategoryList/expandedIdsStorage.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
export const CATEGORY_LIST_EXPANDED_IDS_STORAGE_KEY = "categoryListExpandedIds:v1";

export const normalizeStoredExpandedIds = (storedExpandedIds: unknown): string[] => {
  if (!Array.isArray(storedExpandedIds)) {
    return [];
  }

  return Array.from(
    new Set(storedExpandedIds.filter((id): id is string => typeof id === "string")),
  );
};

export const serializeExpandedIds = (expandedIds: Set<string>): string[] =>
  Array.from(expandedIds).sort();
