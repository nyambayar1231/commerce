// Saleor reads API_URL from window.__SALEOR_CONFIG__ (src/config.ts), filled in at deploy time;
// we use Vite's build-time env instead. The dashboard calls the API cross-origin, as Saleor does.
export const getApiUrl = (): string =>
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/graphql";
