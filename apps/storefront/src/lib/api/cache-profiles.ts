// Cache profiles registered in next.config.ts (`cacheLife`) and used by name in the kernel.
// No `server-only`: next.config.ts imports this file.

/** Catalog, menus, pages and shop: stale 60 s, revalidate 120 s, expire 1 day (ADR-0015). */
export const cacheProfiles = {
  catalog: { stale: 60, revalidate: 120, expire: 86400 },
} as const;
