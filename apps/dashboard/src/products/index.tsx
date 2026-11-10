// Adapted from saleor-dashboard: src/products/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The products section's routes (Saleor's ProductSection), mounted at /products/*. The detail page
// is still a placeholder until M2.4.
import { Route, Routes } from "react-router";

import { PlaceholderPage } from "../components/PlaceholderPage/PlaceholderPage";
import { sectionNames } from "../intl";
import { ProductList } from "./views/ProductList";

export const ProductSection = () => (
  <Routes>
    <Route index element={<ProductList />} />
    <Route path=":id" element={<PlaceholderPage title={sectionNames.products} />} />
  </Routes>
);
