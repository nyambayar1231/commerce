// Adapted from saleor-storefront: postcss.config.cjs (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

// No postcss-import: src/app/globals.css is imported next to brand.css in the root layout.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
