// Copied from saleor-dashboard: src/components/Layouts/Detail/index.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Content } from "./Content";
import { RightSidebar } from "./RightSidebar";
import { RootLayout } from "./Root";

export const DetailPageLayout = Object.assign(RootLayout, {
  Content,
  RightSidebar,
});
