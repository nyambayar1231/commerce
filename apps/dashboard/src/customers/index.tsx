// Adapted from saleor-dashboard: src/customers/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The customers section's routes (Saleor's CustomerSection), mounted at /customers/*: the list.
// The detail and create pages come in M7.5.
import { Route, Routes } from "react-router";

import { NotFound } from "../NotFound";
import { CustomerList } from "./views/CustomerList";

export const CustomerSection = () => (
  <Routes>
    <Route index element={<CustomerList />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);
