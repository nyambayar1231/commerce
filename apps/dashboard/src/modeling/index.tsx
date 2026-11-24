// Adapted from saleor-dashboard: src/modeling/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The modeling section's routes (Saleor's ModelingSection), mounted at /models/*: the list, the
// new page's screen (Saleor's /models/add) and a page. Structures (menus) come in M15.7b.
import { Route, Routes } from "react-router";

import { PageCreate } from "./views/PageCreate";
import { PageDetails } from "./views/PageDetails";
import { PageList } from "./views/PageList";

export const ModelingSection = () => (
  <Routes>
    <Route index element={<PageList />} />
    <Route path="add" element={<PageCreate />} />
    <Route path=":id" element={<PageDetails />} />
  </Routes>
);
