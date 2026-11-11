// Adapted from saleor-dashboard: src/orders/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The orders section's routes (Saleor's OrderSection), mounted at /orders/*: the list and the
// order detail page.
import { Route, Routes } from "react-router";

import { NotFound } from "../NotFound";
import { OrderDetails } from "./views/OrderDetails";
import { OrderList } from "./views/OrderList";

export const OrderSection = () => (
  <Routes>
    <Route index element={<OrderList />} />
    <Route path=":id" element={<OrderDetails />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);
