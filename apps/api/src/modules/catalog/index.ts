// Public surface of the `catalog` module (ARCHITECTURE.md §2).

export type {
  CategoryCreateInput,
  CategoryError,
  CategoryResult,
  CategoryRow,
  CategoryUpdateInput,
} from "./categories.ts";
export { createCategory, deleteCategory, NotFoundError, updateCategory } from "./categories.ts";
export { slugify } from "./slug.ts";
