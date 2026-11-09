// Adapted from saleor-dashboard: src/intl.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Message ids are formatjs's default content hash, the same as Saleor's:
// base64(sha512(`${defaultMessage}#${description}`)).slice(0, 6)
import { defineMessages } from "react-intl";

export const commonMessages = defineMessages({
  dashboard: {
    id: "hzSNj4",
    defaultMessage: "Dashboard",
  },
  email: {
    id: "hJZwTS",
    defaultMessage: "Email address",
  },
});

// Only the sections on our roadmap (M0.3); ids copied unchanged from Saleor.
export const sectionNames = defineMessages({
  catalog: {
    id: "P5HhQl",
    defaultMessage: "Catalog",
    description: "catalog section name",
  },
  categories: {
    id: "sK1FPw",
    defaultMessage: "Categories",
    description: "categories section name",
  },
  configuration: {
    id: "xfGZsi",
    defaultMessage: "Configuration",
    description: "configuration section name",
  },
  customers: {
    id: "McN+wq",
    defaultMessage: "Customers",
    description: "customers section name",
  },
  home: {
    id: "4JW9iJ",
    defaultMessage: "Home",
    description: "home section name",
  },
  orders: {
    id: "Ta9j04",
    defaultMessage: "Orders",
    description: "orders section name",
  },
  products: {
    id: "K8xNLe",
    defaultMessage: "Products",
    description: "products section name",
  },
});
