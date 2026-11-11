// Adapted from saleor-dashboard: src/orders/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The orders section's routes (Saleor's OrderSection), mounted at /orders/*. The order detail
// page (`:id`) arrives in M6.3; until then a row link opens the not-found page.
import { Route, Routes } from "react-router";

import { NotFound } from "../NotFound";
import { OrderList } from "./views/OrderList";

export const OrderSection = () => (
  <Routes>
    <Route index element={<OrderList />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);
