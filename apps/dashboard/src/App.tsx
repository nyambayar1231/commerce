import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { AppLayout } from "./components/AppLayout/AppLayout";
import { PlaceholderPage } from "./components/PlaceholderPage/PlaceholderPage";
import { sectionNames } from "./intl";
import { NotFound } from "./NotFound";

// Saleor's top-level <Switch> (src/index.tsx), limited to the sections on our roadmap.
// "Catalog" is a menu group, not a route: Saleor has no /catalog page.
export function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<PlaceholderPage title={sectionNames.home} />} />
          <Route path="/products/*" element={<PlaceholderPage title={sectionNames.products} />} />
          <Route
            path="/categories/*"
            element={<PlaceholderPage title={sectionNames.categories} />}
          />
          <Route path="/orders/*" element={<PlaceholderPage title={sectionNames.orders} />} />
          <Route path="/customers/*" element={<PlaceholderPage title={sectionNames.customers} />} />
          <Route
            path="/configuration"
            element={<PlaceholderPage title={sectionNames.configuration} />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
