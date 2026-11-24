/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type DateTimeFilterInput = {
  /** The value equal to. */
  eq?: string | null | undefined;
  /** The value included in. */
  oneOf?: Array<string> | null | undefined;
  /** The value in range. */
  range?: DateTimeRangeInput | null | undefined;
};

export type DateTimeRangeInput = {
  /** Start date. */
  gte?: string | null | undefined;
  /** End date. */
  lte?: string | null | undefined;
};

export type DecimalFilterInput = {
  /** The value equal to. */
  eq?: number | null | undefined;
  /** The value included in. */
  oneOf?: Array<number> | null | undefined;
  /** The value in range. */
  range?: DecimalRangeInput | null | undefined;
};

export type DecimalRangeInput = {
  /** Decimal value greater than or equal to. */
  gte?: number | null | undefined;
  /** Decimal value less than or equal to. */
  lte?: number | null | undefined;
};

export type GlobalIdFilterInput = {
  /** The value equal to. */
  eq?: string | number | null | undefined;
  /** The value included in. */
  oneOf?: Array<string | number> | null | undefined;
};

export type OrderDirection =
  /** Specifies an ascending sort order. */
  | 'ASC'
  /** Specifies a descending sort order. */
  | 'DESC';

export type ProductOrder = {
  /** Specifies the direction in which to sort products. */
  direction: OrderDirection;
  /** Sort products by the selected field. */
  field?: ProductOrderField | null | undefined;
};

export type ProductOrderField =
  /** Sort products by creation date. */
  | 'CREATED_AT'
  /** Sort products by update date. */
  | 'LAST_MODIFIED_AT'
  /** Sort products by name. */
  | 'NAME'
  /** Sort products by price. */
  | 'PRICE'
  /** Sort products by publication status. */
  | 'PUBLISHED';

export type ProductWhereInput = {
  /** List of conditions that must be met. */
  AND?: Array<ProductWhereInput> | null | undefined;
  /** A list of conditions of which at least one must be met. */
  OR?: Array<ProductWhereInput> | null | undefined;
  /** Filter by product category. */
  category?: GlobalIdFilterInput | null | undefined;
  /** Filter by collection. */
  collection?: GlobalIdFilterInput | null | undefined;
  /** Filter by product with category assigned. */
  hasCategory?: boolean | null | undefined;
  ids?: Array<string | number> | null | undefined;
  /** Filter by public visibility. */
  isPublished?: boolean | null | undefined;
  /** Filter by the lowest variant price after discounts. */
  minimalPrice?: DecimalFilterInput | null | undefined;
  /** Filter by product name. */
  name?: StringFilterInput | null | undefined;
  /** Filter by product variant price. */
  price?: DecimalFilterInput | null | undefined;
  /** Filter by product slug. */
  slug?: StringFilterInput | null | undefined;
  /** Filter by variants having specific stock status. */
  stockAvailability?: StockAvailability | null | undefined;
  /** Filter by when was the most recent update. */
  updatedAt?: DateTimeFilterInput | null | undefined;
};

export type StockAvailability =
  | 'IN_STOCK'
  | 'OUT_OF_STOCK';

export type StringFilterInput = {
  /** The value equal to. */
  eq?: string | null | undefined;
  /** The value included in. */
  oneOf?: Array<string> | null | undefined;
};

export type ProductCardFragment = { id: string, name: string, slug: string, category: { name: string } | null, small: { url: string, alt: string | null } | null, large: { url: string } | null, minimalVariantPrice: { amount: number, currency: string } | null, variants: Array<{ id: string, quantityAvailable: number | null, price: { amount: number } }> };

export type ProductListingQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
  last?: number | null | undefined;
  before?: string | null | undefined;
  sortBy?: ProductOrder | null | undefined;
  where?: ProductWhereInput | null | undefined;
}>;


export type ProductListingQuery = { products: { totalCount: number | null, edges: Array<{ cursor: string, node: { id: string, name: string, slug: string, category: { name: string } | null, small: { url: string, alt: string | null } | null, large: { url: string } | null, minimalVariantPrice: { amount: number, currency: string } | null, variants: Array<{ id: string, quantityAvailable: number | null, price: { amount: number } }> } }>, pageInfo: { hasNextPage: boolean, hasPreviousPage: boolean, startCursor: string | null, endCursor: string | null } } | null };

export type CategoryBySlugQueryVariables = Exact<{
  slug: string;
}>;


export type CategoryBySlugQuery = { category: { id: string, name: string, slug: string, children: { edges: Array<{ node: { name: string, slug: string } }> } | null } | null };

export type CollectionBySlugQueryVariables = Exact<{
  slug: string;
}>;


export type CollectionBySlugQuery = { collection: { id: string, name: string, slug: string } | null };

export type FilterOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type FilterOptionsQuery = { categories: { edges: Array<{ node: { name: string, slug: string, level: number } }> } | null, collections: { edges: Array<{ node: { name: string, slug: string } }> } | null };

export type ShopInfoQueryVariables = Exact<{ [key: string]: never; }>;


export type ShopInfoQuery = { shop: { name: string } };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const ProductCardFragmentDoc = new TypedDocumentString(`
    fragment ProductCard on Product {
  id
  name
  slug
  category {
    name
  }
  small: thumbnail(size: 256, format: WEBP) {
    url
    alt
  }
  large: thumbnail(size: 512, format: WEBP) {
    url
  }
  minimalVariantPrice {
    amount
    currency
  }
  variants {
    id
    price {
      amount
    }
    quantityAvailable
  }
}
    `, {"fragmentName":"ProductCard"}) as unknown as TypedDocumentString<ProductCardFragment, unknown>;
export const ProductListingDocument = new TypedDocumentString(`
    query ProductListing($first: Int, $after: String, $last: Int, $before: String, $sortBy: ProductOrder, $where: ProductWhereInput) {
  products(
    first: $first
    after: $after
    last: $last
    before: $before
    sortBy: $sortBy
    where: $where
  ) {
    totalCount
    edges {
      cursor
      node {
        ...ProductCard
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
    fragment ProductCard on Product {
  id
  name
  slug
  category {
    name
  }
  small: thumbnail(size: 256, format: WEBP) {
    url
    alt
  }
  large: thumbnail(size: 512, format: WEBP) {
    url
  }
  minimalVariantPrice {
    amount
    currency
  }
  variants {
    id
    price {
      amount
    }
    quantityAvailable
  }
}`) as unknown as TypedDocumentString<ProductListingQuery, ProductListingQueryVariables>;
export const CategoryBySlugDocument = new TypedDocumentString(`
    query CategoryBySlug($slug: String!) {
  category(slug: $slug) {
    id
    name
    slug
    children(first: 50) {
      edges {
        node {
          name
          slug
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<CategoryBySlugQuery, CategoryBySlugQueryVariables>;
export const CollectionBySlugDocument = new TypedDocumentString(`
    query CollectionBySlug($slug: String!) {
  collection(slug: $slug) {
    id
    name
    slug
  }
}
    `) as unknown as TypedDocumentString<CollectionBySlugQuery, CollectionBySlugQueryVariables>;
export const FilterOptionsDocument = new TypedDocumentString(`
    query FilterOptions {
  categories(first: 100) {
    edges {
      node {
        name
        slug
        level
      }
    }
  }
  collections(first: 100) {
    edges {
      node {
        name
        slug
      }
    }
  }
}
    `) as unknown as TypedDocumentString<FilterOptionsQuery, FilterOptionsQueryVariables>;
export const ShopInfoDocument = new TypedDocumentString(`
    query ShopInfo {
  shop {
    name
  }
}
    `) as unknown as TypedDocumentString<ShopInfoQuery, ShopInfoQueryVariables>;