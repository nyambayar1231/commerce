import "@saleor/macaw-ui/style";
import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./theme/provider";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing #root element in index.html");
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
