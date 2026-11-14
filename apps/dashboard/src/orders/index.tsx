// Adapted from saleor-dashboard: src/orders/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The orders section's routes (Saleor's OrderSection), mounted at /orders/*: the list and the
// order detail page with its Fulfill page, and the drafts list (M13.5) with each draft at
// /orders/drafts/:id. The draft page arrives in M13.6; until then a draft opens on the order page.
import { Route, Routes } from "react-router";

import { NotFound } from "../NotFound";
import { OrderDetails } from "./views/OrderDetails";
import { OrderDraftList } from "./views/OrderDraftList";
import { OrderFulfill } from "./views/OrderFulfill";
import { OrderList } from "./views/OrderList";

export const OrderSection = () => (
  <Routes>
    <Route index element={<OrderList />} />
    <Route path="drafts" element={<OrderDraftList />} />
    <Route path="drafts/:id" element={<OrderDetails />} />
    <Route path=":id/fulfill" element={<OrderFulfill />} />
    <Route path=":id" element={<OrderDetails />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);
