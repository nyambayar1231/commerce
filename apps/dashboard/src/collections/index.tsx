// Adapted from saleor-dashboard: src/collections/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The collections section's routes (Saleor's CollectionSection), mounted at /collections/*. The
// detail page is M15.5b; until then `/collections/:id` renders the section placeholder so the
// create dialog's jump works. Saleor's legacy `/collections/add` redirect is not here.
import { Route, Routes } from "react-router";

import { PlaceholderPage } from "../components/PlaceholderPage/PlaceholderPage";
import { sectionNames } from "../intl";
import { CollectionList } from "./views/CollectionList";

export const CollectionSection = () => (
  <Routes>
    <Route index element={<CollectionList />} />
    <Route path=":id" element={<PlaceholderPage title={sectionNames.collections} />} />
  </Routes>
);
