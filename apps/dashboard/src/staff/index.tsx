// Adapted from saleor-dashboard: src/staff/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The staff section, mounted at /staff/* without a permission, as Saleor's: everyone reaches their
// own page, Account settings (PLAN M11.2). Another staff member's page and the list are Not found
// until the staff pages exist.
import { Route, Routes, useParams } from "react-router";

import { useUser } from "../auth/AuthProvider";
import { NotFound } from "../NotFound";
import { AccountSettings } from "./views/AccountSettings";

const StaffMember = () => {
  const { id } = useParams();
  const { user } = useUser();

  return user && id === user.id ? <AccountSettings user={user} /> : <NotFound />;
};

export const StaffSection = () => (
  <Routes>
    <Route path=":id" element={<StaffMember />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);
