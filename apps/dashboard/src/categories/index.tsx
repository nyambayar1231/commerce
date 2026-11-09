// Adapted from saleor-dashboard: src/categories/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The categories section's routes (Saleor's CategorySection), mounted at /categories/*.
import { Route, Routes } from "react-router";

import { CategoryDetails } from "./views/CategoryDetails";
import { CategoryList } from "./views/CategoryList";

export const CategorySection = () => (
  <Routes>
    <Route index element={<CategoryList />} />
    <Route path=":id" element={<CategoryDetails />} />
  </Routes>
);
