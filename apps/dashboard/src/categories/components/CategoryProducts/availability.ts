// Adapted from saleor-dashboard: src/products/components/ProductDoctor/utils/availabilityStatus.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The category's Products card is single-channel, so Saleor's live/scheduled/hidden collapses to
// published/hidden: a publication date in the future stays hidden until it passes (Saleor would say
// "Scheduled"). Saleor's 2-second tolerance avoids a "scheduled" flash from clock skew.
const PUBLICATION_CLOCK_TOLERANCE_MS = 2000;

export type ProductAvailability = "published" | "hidden";

export const getProductAvailability = (
  product: { isPublished: boolean; publishedAt: unknown },
  dateNow: number,
): ProductAvailability => {
  if (!product.isPublished) {
    return "hidden";
  }

  // Our codegen has no DateTime scalar mapping, so publishedAt arrives as `unknown`.
  const publishedAt =
    typeof product.publishedAt === "string" ? Date.parse(product.publishedAt) : null;
  const isScheduledForFuture =
    publishedAt !== null && publishedAt > dateNow + PUBLICATION_CLOCK_TOLERANCE_MS;

  return isScheduledForFuture ? "hidden" : "published";
};
