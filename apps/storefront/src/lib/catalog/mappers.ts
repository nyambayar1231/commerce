import type {
  CategoryBySlugQuery,
  CollectionBySlugQuery,
  FilterOptionsQuery,
  ProductCardFragment,
  ProductListingQuery,
} from "@/gql/graphql";
import { formatMoney } from "@/lib/format";
import { toMoney } from "@/lib/money";
import type {
  CategoryView,
  CollectionView,
  FilterOptionsView,
  ListingView,
  ProductCardView,
} from "./types";

// The one place generated GraphQL types become view models (ARCHITECTURE §10.3), and the one
// place API `Money { amount }` becomes a formatted string on the server (§10.11).

const CARD_IMAGE_SIZES = { small: 256, large: 512 } as const;

/** A product as the grid shows it: one link, one image, a price string, stock as text. */
export function toProductCard(node: ProductCardFragment): ProductCardView {
  const onlyVariant = node.variants.length === 1 ? node.variants[0] : undefined;
  const prices = new Set(node.variants.map((variant) => variant.price.amount));
  return {
    id: node.id,
    name: node.name,
    href: `/products/${node.slug}`,
    categoryName: node.category?.name ?? null,
    image:
      node.small === null
        ? null
        : {
            src: node.small.url,
            srcSet:
              node.large === null
                ? `${node.small.url} ${CARD_IMAGE_SIZES.small}w`
                : `${node.small.url} ${CARD_IMAGE_SIZES.small}w, ${node.large.url} ${CARD_IMAGE_SIZES.large}w`,
            alt: node.small.alt ?? node.name,
          },
    price:
      node.minimalVariantPrice === null ? null : formatMoney(toMoney(node.minimalVariantPrice)),
    priceFrom: prices.size > 1,
    // Untracked stock (`quantityAvailable: null`) is available; a product with no variants has
    // nothing to sell out.
    soldOut:
      node.variants.length > 0 && node.variants.every((variant) => variant.quantityAvailable === 0),
    quickAddVariantId:
      onlyVariant !== undefined && onlyVariant.quantityAvailable !== 0 ? onlyVariant.id : null,
  };
}

/** The listing query's connection as the page's view. */
export function toListing(products: NonNullable<ProductListingQuery["products"]>): ListingView {
  return {
    items: products.edges.map((edge) => toProductCard(edge.node)),
    totalCount: products.totalCount ?? null,
    pageInfo: products.pageInfo,
  };
}

export function toCategory(category: NonNullable<CategoryBySlugQuery["category"]>): CategoryView {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    children: category.children?.edges.map((edge) => edge.node) ?? [],
  };
}

export function toCollection(
  collection: NonNullable<CollectionBySlugQuery["collection"]>,
): CollectionView {
  return { id: collection.id, name: collection.name, slug: collection.slug };
}

/** The filter bar's options: all categories (indentation is by `level`) and all collections. */
export function toFilterOptions(data: FilterOptionsQuery): FilterOptionsView {
  return {
    categories: data.categories?.edges.map((edge) => edge.node) ?? [],
    collections: data.collections?.edges.map((edge) => edge.node) ?? [],
  };
}
