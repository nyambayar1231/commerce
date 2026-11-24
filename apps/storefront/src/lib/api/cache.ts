// Cache tag builders (ARCHITECTURE §10.7). The only place tag names are spelled.
export const tags = {
  products: "products",
  product: (slug: string) => `product:${slug}`,
  category: (slug: string) => `category:${slug}`,
  collection: (slug: string) => `collection:${slug}`,
  page: (slug: string) => `page:${slug}`,
  menu: (slug: string) => `menu:${slug}`,
  shop: "shop",
} as const;
