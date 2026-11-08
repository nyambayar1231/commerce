// Adapted from saleor-dashboard: src/NotFound.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useNavigate } from "react-router";

import { NotFoundPage } from "./components/NotFoundPage/NotFoundPage";

export const NotFound = () => {
  const navigate = useNavigate();

  return <NotFoundPage onBack={() => navigate("/")} />;
};
