/// <reference types="vite/client" />

// Macaw's stylesheet subpath export has no .css extension, so vite/client's `*.css` doesn't match.
declare module "@saleor/macaw-ui/style";

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
