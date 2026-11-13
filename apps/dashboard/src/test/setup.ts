import { beforeEach } from "vitest";

// Component tests read the English texts; the dashboard's default language is Mongolian
// (PLAN M11), so every test starts in English unless it sets `locale` itself (Locale.test.tsx).
// After the tests' own localStorage.clear() calls too: this runs before each test.
beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.setItem("locale", "en");
});
