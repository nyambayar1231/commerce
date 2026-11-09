import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { Auth } from "./auth";
import { useUser } from "./auth/AuthProvider";
import { LoginLoading } from "./auth/components/LoginLoading/LoginLoading";
import SectionRoute from "./auth/components/SectionRoute";
import { AppLayout } from "./components/AppLayout/AppLayout";
import { PlaceholderPage } from "./components/PlaceholderPage/PlaceholderPage";
import { CONFIGURATION_PERMISSIONS } from "./components/Sidebar/menu/hooks/useMenuStructure";
import { sectionNames } from "./intl";
import { NotFound } from "./NotFound";

// Saleor's top-level <Switch> (src/index.tsx), limited to the sections on our roadmap.
// "Catalog" is a menu group, not a route: Saleor has no /catalog page.
// Like Saleor, signed-out visitors get the login screen instead of the app (no redirect), and a
// spinner while the session is checked. Section routes require the same permissions as Saleor
// (src/index.tsx) and show NotFound otherwise; the server stays the authority.
export function App() {
  const { user, authenticating } = useUser();

  return (
    <BrowserRouter>
      {user ? <Dashboard /> : authenticating ? <LoginLoading /> : <Auth />}
    </BrowserRouter>
  );
}

function Dashboard() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<PlaceholderPage title={sectionNames.home} />} />
        <Route
          path="/products/*"
          element={
            <SectionRoute permissions={["MANAGE_PRODUCTS"]}>
              <PlaceholderPage title={sectionNames.products} />
            </SectionRoute>
          }
        />
        <Route
          path="/categories/*"
          element={
            <SectionRoute permissions={["MANAGE_PRODUCTS"]}>
              <PlaceholderPage title={sectionNames.categories} />
            </SectionRoute>
          }
        />
        <Route
          path="/orders/*"
          element={
            <SectionRoute permissions={["MANAGE_ORDERS"]}>
              <PlaceholderPage title={sectionNames.orders} />
            </SectionRoute>
          }
        />
        <Route
          path="/customers/*"
          element={
            <SectionRoute
              permissions={["MANAGE_USERS", "MANAGE_ORDERS", "MANAGE_STAFF"]}
              matchPermission="any"
            >
              <PlaceholderPage title={sectionNames.customers} />
            </SectionRoute>
          }
        />
        <Route
          path="/configuration"
          element={
            <SectionRoute permissions={CONFIGURATION_PERMISSIONS} matchPermission="any">
              <PlaceholderPage title={sectionNames.configuration} />
            </SectionRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}
