import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { addToCart } from "@/lib/cart/actions";
import { serializeJsonLd } from "@/lib/catalog/json-ld";
import {
  FEATURED_COLLECTION_SLUG,
  getFeaturedCollection,
  getHomeCategories,
} from "@/lib/content/home";
import { getShop } from "@/lib/content/shop";
import { getEnv } from "@/lib/env";
import { buildOrganizationJsonLd } from "@/lib/seo/organization";
import {
  CategoryTileGrid,
  CategoryTileGridSkeleton,
} from "@/ui/sections/category-tile-grid/category-tile-grid";
import { FeaturedCollectionSection } from "@/ui/sections/featured-collection-section/featured-collection-section";
import { FeaturedCollectionSkeleton } from "@/ui/sections/featured-collection-section/featured-collection-skeleton";
import { HeroBanner, HeroBannerSkeleton } from "@/ui/sections/hero-banner/hero-banner";

// The home page (ARCHITECTURE §10.4): a synchronous shell, each section its own island in
// `<Suspense>` with a sized skeleton. The hero's copy and the metadata come from `messages`
// (only the shop's name is data); the featured section and the tiles hide themselves when
// there is nothing to show.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return {
    description: t("description"),
    alternates: { canonical: `${getEnv().storefrontUrl}/` },
  };
}

export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <OrganizationJsonLd />
      </Suspense>
      <Suspense fallback={<HeroBannerSkeleton />}>
        <HomeHero />
      </Suspense>
      <Suspense fallback={<FeaturedCollectionSkeleton />}>
        <HomeFeatured />
      </Suspense>
      <Suspense fallback={<CategoryTileGridSkeleton />}>
        <HomeCategories />
      </Suspense>
    </>
  );
}

/** `Organization` structured data (§10.14): the shop's name and the storefront origin. */
async function OrganizationJsonLd() {
  const shop = await getShop();
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped by serializeJsonLd (< > &), so the shop name cannot break out of the script element (ARCHITECTURE §10.13)
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(buildOrganizationJsonLd(shop.name, getEnv().storefrontUrl)),
      }}
    />
  );
}

/** The hero: copy from `messages`, with the shop's name in the heading. */
async function HomeHero() {
  const [t, shop] = await Promise.all([getTranslations("home"), getShop()]);
  return (
    <HeroBanner
      heading={t("title", { shopName: shop.name })}
      subheading={t("subtitle")}
      primaryCta={{ label: t("browse"), href: "/products" }}
    />
  );
}

/** The featured collection; hidden while the `featured-products` collection is missing or empty. */
async function HomeFeatured() {
  const featured = await getFeaturedCollection();
  if (featured === null) return null;
  return (
    <FeaturedCollectionSection
      name={featured.name}
      items={featured.items}
      viewAllHref={`/collections/${FEATURED_COLLECTION_SLUG}`}
      addAction={addToCart}
    />
  );
}

/** The top-level categories as tiles; hidden while the shop has none. */
async function HomeCategories() {
  const [t, categories] = await Promise.all([getTranslations("home"), getHomeCategories()]);
  if (categories.length === 0) return null;
  return <CategoryTileGrid heading={t("categoriesTitle")} tiles={categories} />;
}
