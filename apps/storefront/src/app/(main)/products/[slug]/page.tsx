import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { buildBreadcrumbJsonLd, buildProductJsonLd, serializeJsonLd } from "@/lib/catalog/json-ld";
import { getProduct } from "@/lib/catalog/product";
import type { ProductView, VariantView } from "@/lib/catalog/types";
import { getEnv } from "@/lib/env";
import { Breadcrumbs } from "@/ui/components/breadcrumbs";
import { AddToCart, type AddToCartState } from "@/ui/components/pdp/add-to-cart";
import { BuyBoxFallback } from "@/ui/components/pdp/buy-box-fallback";
import { PDP_LAYOUT } from "@/ui/components/pdp/gallery-layout";
import {
  getGalleryImages,
  type RawSearchParams,
  resolveSelectedVariant,
  variantParam,
} from "@/ui/components/pdp/gallery-utils";
import { NonMatrixBuyBox } from "@/ui/components/pdp/non-matrix-buy-box";
import { ProductGallery } from "@/ui/components/pdp/product-gallery";
import { ProductGalleryFallback } from "@/ui/components/pdp/product-gallery-fallback";
import { ProductRouteSkeleton } from "@/ui/components/pdp/product-route-skeleton";
import { StickyBar } from "@/ui/components/pdp/sticky-bar";
import { RichText } from "@/ui/components/rich-text";

// The product page (M4.3, ARCHITECTURE §10.4): a synchronous shell with a `ProductDetails`
// island (gallery, name, breadcrumbs, description) that holds two nested islands reading
// `searchParams` — the gallery (a selected variant's media first) and the buy box (the
// selected variant's price and stock). An unknown slug is `notFound()` from the island, a
// soft 404 (§10.14). No API call at build time (§10.7): the loader awaits `connection()`.

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (product === null) notFound();
  const first = product.images[0];
  return {
    title: product.name,
    description: product.descriptionText === "" ? undefined : product.descriptionText,
    alternates: { canonical: `${getEnv().storefrontUrl}${product.url}` },
    // Open Graph: the first image's 1024 rung (§10.12).
    openGraph: first === undefined ? undefined : { images: [first.src] },
  };
}

export default function ProductPage({ params, searchParams }: PageProps) {
  const t = useTranslations("pdp");
  return (
    <div className={PDP_LAYOUT.main}>
      <Suspense fallback={<ProductRouteSkeleton label={t("loading")} />}>
        <ProductDetails params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** The product's identity: the JSON-LD, breadcrumbs, the name, and the two dynamic slots. */
async function ProductDetails({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const [product, tPdp, tBreadcrumbs, tCheckout] = await Promise.all([
    getProduct(slug),
    getTranslations("pdp"),
    getTranslations("breadcrumbs"),
    getTranslations("checkout"),
  ]);
  if (product === null) notFound();

  // The default gallery order (no variant): what the fallback shows and the JSON-LD lists.
  const defaultImages = getGalleryImages(product, null);
  const baseUrl = getEnv().storefrontUrl;
  const breadcrumbItems = [
    { name: tBreadcrumbs("home"), href: "/" },
    ...product.breadcrumbs,
    // The current crumb: never a link, but present in the BreadcrumbList with its URL.
    { name: product.name, href: product.url },
  ];
  // The buy box's fallback shows what a visitor without `?variant=` sees: the price range.
  const fallbackPrice =
    product.priceRange.max === null
      ? product.priceRange.min
      : tPdp("priceFrom", { price: product.priceRange.min });

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the payload is escaped by serializeJsonLd (< > &), so catalog text cannot break out of the script element (ARCHITECTURE §10.13)
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildProductJsonLd(product, baseUrl)) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: same escaping as the Product payload above
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildBreadcrumbJsonLd(breadcrumbItems, baseUrl)),
        }}
      />

      <Breadcrumbs
        items={breadcrumbItems}
        ariaLabel={tBreadcrumbs("ariaLabel")}
        className="mb-6 hidden sm:block"
      />

      <div className={PDP_LAYOUT.grid}>
        <div className={PDP_LAYOUT.galleryColumn}>
          <Suspense
            fallback={
              <ProductGalleryFallback
                image={defaultImages[0] ?? null}
                imageCount={defaultImages.length}
              />
            }
          >
            <VariantGallery product={product} searchParams={searchParams} />
          </Suspense>
        </div>

        <div className={PDP_LAYOUT.infoColumn}>
          <h1 className="order-2 text-balance text-h1">{product.name}</h1>
          <Suspense
            fallback={
              <BuyBoxFallback
                price={fallbackPrice}
                selectVariantLabel={tPdp("selectVariant")}
                secureCheckoutLabel={tCheckout("secureCheckout")}
              />
            }
          >
            <BuyBox product={product} searchParams={searchParams} />
          </Suspense>
        </div>

        <div className={PDP_LAYOUT.attributesGalleryBlock}>
          <h2 className="mb-4 text-h3">{tPdp("description")}</h2>
          <RichText blocks={product.description} />
        </div>
      </div>
    </>
  );
}

/** The gallery island: `?variant=` decides whether the selected variant's media comes first. */
async function VariantGallery({
  product,
  searchParams,
}: {
  product: ProductView;
  searchParams: Promise<RawSearchParams>;
}) {
  const search = await searchParams;
  const selected = resolveSelectedVariant(product, variantParam(search));
  const images = getGalleryImages(product, selected);
  return <ProductGallery images={images} productName={product.name} />;
}

/** The buy box island: the variant list, the selected price and stock, the add-to-cart form. */
async function BuyBox({
  product,
  searchParams,
}: {
  product: ProductView;
  searchParams: Promise<RawSearchParams>;
}) {
  const [search, tPdp] = await Promise.all([searchParams, getTranslations("pdp")]);
  const selected = resolveSelectedVariant(product, variantParam(search));
  const buttonState = addToCartState(selected);
  const price =
    selected === null
      ? product.priceRange.max === null
        ? product.priceRange.min
        : tPdp("priceFrom", { price: product.priceRange.min })
      : selected.price;
  // The sticky bar follows a buyable selection (Paper: it hides while the ATC is disabled).
  const stickyShow = selected !== null && selected.stock !== "outOfStock";

  return (
    <form className="order-3 mt-4 space-y-6">
      <NonMatrixBuyBox
        variants={product.variants}
        selectedVariantId={selected?.id ?? null}
        productSlug={product.slug}
      />
      <AddToCart
        price={price}
        stock={selected === null ? null : { state: selected.stock, quantity: selected.quantity }}
        buttonState={buttonState}
        variantId={selected?.id ?? null}
      />
      <StickyBar
        productName={product.name}
        price={price}
        show={stickyShow}
        buttonState={buttonState}
        variantId={selected?.id ?? null}
      />
    </form>
  );
}

/** The add-to-cart button's state: nothing chosen, the chosen variant sold out, or ready. */
function addToCartState(selected: VariantView | null): AddToCartState {
  if (selected === null) return "chooseVariant";
  return selected.stock === "outOfStock" ? "outOfStock" : "ready";
}
