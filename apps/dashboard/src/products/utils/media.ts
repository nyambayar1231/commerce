// Adapted from saleor-dashboard: src/products/utils/data.ts (getSelectedMedia) and
// src/products/utils/handlers.ts (areMediaSelectionsEqual) (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variant media selection's helpers: the chosen images in the product's media order, whether
// two selections hold the same ids (the form's dirty check and the dialog's Confirm enablement),
// and the diff a save sends as variantMediaAssign / variantMediaUnassign.
export interface MediaLike {
  id: string;
  sortOrder: number | null;
}

/** Saleor's getSelectedMedia: the chosen media, ordered like the product's gallery. */
export const getSelectedMedia = <T extends MediaLike>(
  media: readonly T[] = [],
  selectedMediaIds: readonly string[] = [],
): T[] =>
  media
    .filter((image) => selectedMediaIds.includes(image.id))
    .sort((previous, next) => (previous.sortOrder ?? 0) - (next.sortOrder ?? 0));

/** Saleor's areMediaSelectionsEqual: the same ids in any order. */
export const areMediaSelectionsEqual = (
  left: readonly string[] = [],
  right: readonly string[] = [],
): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const rightIds = new Set(right);

  return left.every((id) => rightIds.has(id));
};

export interface MediaDiff {
  /** Selected but not saved: sent to variantMediaAssign. */
  added: string[];
  /** Saved but no longer selected: sent to variantMediaUnassign. */
  removed: string[];
}

/** Saleor's fast-array-diff call in handleAssignMedia, limited to two id lists. */
export const getMediaDiff = (
  savedIds: readonly string[],
  selectedIds: readonly string[],
): MediaDiff => ({
  added: selectedIds.filter((id) => !savedIds.includes(id)),
  removed: savedIds.filter((id) => !selectedIds.includes(id)),
});
