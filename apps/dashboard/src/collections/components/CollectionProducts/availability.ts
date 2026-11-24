// Adapted from saleor-dashboard: src/components/ChannelsAvailabilityDropdown/utils.ts and
// src/products/components/ProductDoctor/utils/availabilityStatus.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The card is single-channel, so a product is published, scheduled (a publication date in the
// future; Saleor's 2-second tolerance avoids a "scheduled" flash from clock skew) or not published.
// The collection list repeats the same rule (../CollectionListDatagrid/datagrid.ts); it stays local
// per list until a shared helper earns its place.
const PUBLICATION_CLOCK_TOLERANCE_MS = 2000;

export type ProductAvailability = "published" | "scheduled" | "not-published";

export const getProductAvailability = (
  product: { isPublished: boolean; publishedAt: unknown },
  dateNow: number,
): ProductAvailability => {
  if (!product.isPublished) {
    return "not-published";
  }

  // Our codegen has no DateTime scalar mapping, so publishedAt arrives as `unknown`.
  const publishedAt =
    typeof product.publishedAt === "string" ? Date.parse(product.publishedAt) : null;
  const isScheduledForFuture =
    publishedAt !== null && publishedAt > dateNow + PUBLICATION_CLOCK_TOLERANCE_MS;

  return isScheduledForFuture ? "scheduled" : "published";
};
