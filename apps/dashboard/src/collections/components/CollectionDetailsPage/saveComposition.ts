// Adapted from saleor-dashboard: src/collections/components/CollectionDetailsPage/saveComposition.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's general fields also include slug, SEO and the background image alt; ours are name and
// description. Saleor's channel segment becomes "availability": our single-channel card toggles the
// collection's own `isPublished`, which Save sends with the rest.
export interface CollectionSaveComposition {
  hasGeneral: boolean;
  hasAvailability: boolean;
}

const GENERAL_FIELD_KEYS = ["name"] as const;

export const buildCollectionSaveComposition = (
  changedFieldNames: ReadonlyArray<string>,
  descriptionDirty: boolean,
): CollectionSaveComposition => ({
  hasGeneral:
    descriptionDirty || GENERAL_FIELD_KEYS.some((field) => changedFieldNames.includes(field)),
  hasAvailability: changedFieldNames.includes("isPublished"),
});

export const hasCollectionSaveComposition = (composition: CollectionSaveComposition): boolean =>
  composition.hasGeneral || composition.hasAvailability;

export const EMPTY_COLLECTION_SAVE_COMPOSITION: CollectionSaveComposition = {
  hasGeneral: false,
  hasAvailability: false,
};
