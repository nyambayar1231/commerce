// Adapted from saleor-dashboard: src/auth/components/LoginLoading/LoginLoading.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor shows its animated logo (SaleorThrobber); Macaw's Spinner takes its place.
import { Box, Spinner } from "@saleor/macaw-ui";

export const LoginLoading = () => (
  <Box display="flex" alignItems="center" justifyContent="center" style={{ height: "100vh" }}>
    <Spinner />
  </Box>
);
