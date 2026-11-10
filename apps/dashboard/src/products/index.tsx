// Adapted from saleor-dashboard: src/products/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The products section's routes (Saleor's ProductSection), mounted at /products/*.
import { Route, Routes } from "react-router";

import { ProductList } from "./views/ProductList";
import { ProductUpdate } from "./views/ProductUpdate/ProductUpdate";

export const ProductSection = () => (
  <Routes>
    <Route index element={<ProductList />} />
    <Route path=":id" element={<ProductUpdate />} />
  </Routes>
);
