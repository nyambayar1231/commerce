// Adapted from saleor-dashboard: src/collections/components/CollectionDetailsPage/saveComposition.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's page screen has no save composition; this follows its collection page. Saleor's general
// fields also include the slug, SEO and the page type; ours are the title and the content. Saleor's
// channel segment becomes "availability": our single-channel card toggles the page's own
// `isPublished`, which Save sends with the rest.
export interface PageSaveComposition {
  hasGeneral: boolean;
  hasAvailability: boolean;
}

const GENERAL_FIELD_KEYS = ["title"] as const;

export const buildPageSaveComposition = (
  changedFieldNames: ReadonlyArray<string>,
  contentDirty: boolean,
): PageSaveComposition => ({
  hasGeneral: contentDirty || GENERAL_FIELD_KEYS.some((field) => changedFieldNames.includes(field)),
  hasAvailability: changedFieldNames.includes("isPublished"),
});

export const hasPageSaveComposition = (composition: PageSaveComposition): boolean =>
  composition.hasGeneral || composition.hasAvailability;

export const EMPTY_PAGE_SAVE_COMPOSITION: PageSaveComposition = {
  hasGeneral: false,
  hasAvailability: false,
};
