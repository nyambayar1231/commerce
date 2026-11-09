// Public surface of the `catalog` module (ARCHITECTURE.md §2).

export type {
  CategoryCreateInput,
  CategoryError,
  CategoryResult,
  CategoryRow,
  CategoryUpdateInput,
} from "./categories.ts";
export {
  createCategory,
  deleteCategories,
  deleteCategory,
  getCategory,
  getCategoryLevel,
  NotFoundError,
  updateCategory,
} from "./categories.ts";
export type {
  CategoryListArgs,
  CategoryListRow,
  CategoryPage,
  CategorySortField,
  OrderDirection,
} from "./categoryList.ts";
export { InvalidCursorError, listCategories } from "./categoryList.ts";
export { DEMO_CATEGORIES, seedDemoCatalog } from "./demoCatalog.ts";
export { slugify } from "./slug.ts";
