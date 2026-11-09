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
export type { CatalogLoaders } from "./loaders.ts";
export { createCatalogLoaders } from "./loaders.ts";
export type {
  ProductListArgs,
  ProductListRow,
  ProductPage,
  ProductSortField,
} from "./productList.ts";
export { listProducts } from "./productList.ts";
export type { ProductRow, ProductVariantRow } from "./products.ts";
export { getMinimalVariantPrice, getProduct, getProductVariants, toMoney } from "./products.ts";
export { slugify } from "./slug.ts";
