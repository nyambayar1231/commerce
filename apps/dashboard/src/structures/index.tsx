// Adapted from saleor-dashboard: src/structures/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The structures section's routes (Saleor's NavigationRouter), mounted at /structures/*: the list
// and a menu.
import { Route, Routes } from "react-router";

import { MenuDetails } from "./views/MenuDetails";
import { MenuList } from "./views/MenuList";

export const StructuresSection = () => (
  <Routes>
    <Route index element={<MenuList />} />
    <Route path=":id" element={<MenuDetails />} />
  </Routes>
);
