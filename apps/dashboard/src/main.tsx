import "@saleor/macaw-ui/style";
import "./index.css";

import { ApolloProvider } from "@apollo/client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { LocaleProvider } from "./components/Locale/Locale";
import { ShopProvider } from "./components/Shop";
import { apolloClient } from "./graphql/client";
import { ThemeProvider } from "./theme/provider";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing #root element in index.html");
}

createRoot(container).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <LocaleProvider>
        <AuthProvider>
          <ShopProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </ShopProvider>
        </AuthProvider>
      </LocaleProvider>
    </ApolloProvider>
  </StrictMode>,
);
