// Adapted from saleor-dashboard: src/products/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The products section's routes (Saleor's ProductSection), mounted at /products/*.
import { Route, Routes } from "react-router";
import { ProductImage } from "./views/ProductImage/ProductImage";
import { ProductList } from "./views/ProductList";
import { ProductUpdate } from "./views/ProductUpdate/ProductUpdate";
import { ProductVariant } from "./views/ProductVariant/ProductVariant";
import { ProductVariantCreate } from "./views/ProductVariantCreate/ProductVariantCreate";

export const ProductSection = () => (
  <Routes>
    <Route index element={<ProductList />} />
    {/* Saleor 3.23's variant paths; both are declared before the product's own `:id` route. */}
    <Route path="variant/:variantId" element={<ProductVariant />} />
    <Route path=":productId/variant/add" element={<ProductVariantCreate />} />
    {/* Saleor's image page, declared before the product's own `:id` route too. */}
    <Route path=":productId/image/:imageId" element={<ProductImage />} />
    <Route path=":id" element={<ProductUpdate />} />
  </Routes>
);
