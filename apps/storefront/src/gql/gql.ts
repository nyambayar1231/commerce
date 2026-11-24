/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "fragment ProductCard on Product {\n  id\n  name\n  slug\n  category {\n    name\n  }\n  small: thumbnail(size: 256, format: WEBP) {\n    url\n    alt\n  }\n  large: thumbnail(size: 512, format: WEBP) {\n    url\n  }\n  minimalVariantPrice {\n    amount\n    currency\n  }\n  variants {\n    id\n    price {\n      amount\n    }\n    quantityAvailable\n  }\n}\n\nquery ProductListing($first: Int, $after: String, $last: Int, $before: String, $sortBy: ProductOrder, $where: ProductWhereInput) {\n  products(\n    first: $first\n    after: $after\n    last: $last\n    before: $before\n    sortBy: $sortBy\n    where: $where\n  ) {\n    totalCount\n    edges {\n      cursor\n      node {\n        ...ProductCard\n      }\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}\n\nquery CategoryBySlug($slug: String!) {\n  category(slug: $slug) {\n    id\n    name\n    slug\n    children(first: 50) {\n      edges {\n        node {\n          name\n          slug\n        }\n      }\n    }\n  }\n}\n\nquery CollectionBySlug($slug: String!) {\n  collection(slug: $slug) {\n    id\n    name\n    slug\n  }\n}\n\nquery FilterOptions {\n  categories(first: 100) {\n    edges {\n      node {\n        name\n        slug\n        level\n      }\n    }\n  }\n  collections(first: 100) {\n    edges {\n      node {\n        name\n        slug\n      }\n    }\n  }\n}": typeof types.ProductCardFragmentDoc,
    "query ShopInfo {\n  shop {\n    name\n  }\n}": typeof types.ShopInfoDocument,
};
const documents: Documents = {
    "fragment ProductCard on Product {\n  id\n  name\n  slug\n  category {\n    name\n  }\n  small: thumbnail(size: 256, format: WEBP) {\n    url\n    alt\n  }\n  large: thumbnail(size: 512, format: WEBP) {\n    url\n  }\n  minimalVariantPrice {\n    amount\n    currency\n  }\n  variants {\n    id\n    price {\n      amount\n    }\n    quantityAvailable\n  }\n}\n\nquery ProductListing($first: Int, $after: String, $last: Int, $before: String, $sortBy: ProductOrder, $where: ProductWhereInput) {\n  products(\n    first: $first\n    after: $after\n    last: $last\n    before: $before\n    sortBy: $sortBy\n    where: $where\n  ) {\n    totalCount\n    edges {\n      cursor\n      node {\n        ...ProductCard\n      }\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}\n\nquery CategoryBySlug($slug: String!) {\n  category(slug: $slug) {\n    id\n    name\n    slug\n    children(first: 50) {\n      edges {\n        node {\n          name\n          slug\n        }\n      }\n    }\n  }\n}\n\nquery CollectionBySlug($slug: String!) {\n  collection(slug: $slug) {\n    id\n    name\n    slug\n  }\n}\n\nquery FilterOptions {\n  categories(first: 100) {\n    edges {\n      node {\n        name\n        slug\n        level\n      }\n    }\n  }\n  collections(first: 100) {\n    edges {\n      node {\n        name\n        slug\n      }\n    }\n  }\n}": types.ProductCardFragmentDoc,
    "query ShopInfo {\n  shop {\n    name\n  }\n}": types.ShopInfoDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "fragment ProductCard on Product {\n  id\n  name\n  slug\n  category {\n    name\n  }\n  small: thumbnail(size: 256, format: WEBP) {\n    url\n    alt\n  }\n  large: thumbnail(size: 512, format: WEBP) {\n    url\n  }\n  minimalVariantPrice {\n    amount\n    currency\n  }\n  variants {\n    id\n    price {\n      amount\n    }\n    quantityAvailable\n  }\n}\n\nquery ProductListing($first: Int, $after: String, $last: Int, $before: String, $sortBy: ProductOrder, $where: ProductWhereInput) {\n  products(\n    first: $first\n    after: $after\n    last: $last\n    before: $before\n    sortBy: $sortBy\n    where: $where\n  ) {\n    totalCount\n    edges {\n      cursor\n      node {\n        ...ProductCard\n      }\n    }\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}\n\nquery CategoryBySlug($slug: String!) {\n  category(slug: $slug) {\n    id\n    name\n    slug\n    children(first: 50) {\n      edges {\n        node {\n          name\n          slug\n        }\n      }\n    }\n  }\n}\n\nquery CollectionBySlug($slug: String!) {\n  collection(slug: $slug) {\n    id\n    name\n    slug\n  }\n}\n\nquery FilterOptions {\n  categories(first: 100) {\n    edges {\n      node {\n        name\n        slug\n        level\n      }\n    }\n  }\n  collections(first: 100) {\n    edges {\n      node {\n        name\n        slug\n      }\n    }\n  }\n}"): typeof import('./graphql').ProductCardFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ShopInfo {\n  shop {\n    name\n  }\n}"): typeof import('./graphql').ShopInfoDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
