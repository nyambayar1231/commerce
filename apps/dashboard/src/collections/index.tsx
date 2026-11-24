// Adapted from saleor-dashboard: src/collections/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The collections section's routes (Saleor's CollectionSection), mounted at /collections/*. Saleor's
// legacy `/collections/add` redirect is not here.
import { Route, Routes } from "react-router";

import { CollectionDetails } from "./views/CollectionDetails";
import { CollectionList } from "./views/CollectionList";

export const CollectionSection = () => (
  <Routes>
    <Route index element={<CollectionList />} />
    <Route path=":id" element={<CollectionDetails />} />
  </Routes>
);
