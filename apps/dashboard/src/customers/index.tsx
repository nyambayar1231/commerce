// Adapted from saleor-dashboard: src/customers/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The customers section's routes (Saleor's CustomerSection), mounted at /customers/*: the list,
// the create page (MANAGE_USERS only, as Saleor; others get Not found) and the customer page.
// Saleor's addresses page is left out (no address book: PLAN M7 decision 4).
import { Route, Routes } from "react-router";

import { useUser } from "../auth/AuthProvider";
import { hasPermission } from "../auth/misc";
import { NotFound } from "../NotFound";
import { CustomerCreate } from "./views/CustomerCreate";
import { CustomerDetails } from "./views/CustomerDetails";
import { CustomerList } from "./views/CustomerList";

export const CustomerSection = () => {
  const { user } = useUser();
  const canEdit = !!user && hasPermission("MANAGE_USERS", user);

  return (
    <Routes>
      <Route index element={<CustomerList />} />
      <Route path="add" element={canEdit ? <CustomerCreate /> : <NotFound />} />
      <Route path=":id" element={<CustomerDetails />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
