// Adapted from saleor-dashboard: src/categories/components/CategoryUpdatePage/saveComposition.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's general fields also include slug, SEO and the background image alt; ours are name and
// description so far.
export interface CategorySaveComposition {
  hasGeneral: boolean;
}

const GENERAL_FIELD_KEYS = ["name"] as const;

export const buildCategorySaveComposition = (
  changedFieldNames: ReadonlyArray<string>,
  descriptionDirty: boolean,
): CategorySaveComposition => ({
  hasGeneral:
    descriptionDirty || GENERAL_FIELD_KEYS.some((field) => changedFieldNames.includes(field)),
});

export const hasCategorySaveComposition = (composition: CategorySaveComposition): boolean =>
  composition.hasGeneral;

export const EMPTY_CATEGORY_SAVE_COMPOSITION: CategorySaveComposition = {
  hasGeneral: false,
};
