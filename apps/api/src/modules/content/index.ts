// Public surface of the `content` module (ARCHITECTURE.md §2): pages now, menus in M15.6b.

export type {
  PageListArgs,
  PageListRow,
  PagePage,
  PageSortField,
} from "./pageList.ts";
export { listPages } from "./pageList.ts";
export type {
  PageCreateInput,
  PageError,
  PageErrorCode,
  PageResult,
  PageRow,
  PageUpdateInput,
} from "./pages.ts";
export {
  createPage,
  deletePage,
  deletePages,
  getPage,
  isPagePublished,
  PageNotFoundError,
  updatePage,
} from "./pages.ts";
