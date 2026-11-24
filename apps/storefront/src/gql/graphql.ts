/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type AccountErrorCode =
  | 'ACCOUNT_NOT_CONFIRMED'
  | 'DELETE_OWN_ACCOUNT'
  | 'DELETE_STAFF_ACCOUNT'
  | 'DELETE_SUPERUSER_ACCOUNT'
  | 'INACTIVE'
  | 'INVALID'
  | 'INVALID_CREDENTIALS'
  | 'LOGIN_ATTEMPT_DELAYED'
  | 'NOT_FOUND'
  | 'OUT_OF_SCOPE_GROUP'
  | 'PASSWORD_TOO_SHORT'
  | 'REQUIRED'
  | 'UNIQUE'
  | 'UNKNOWN_IP_ADDRESS';

/** Fields required to create a user. */
export type AccountRegisterInput = {
  /** The email address of the user. */
  email: string;
  /** Given name. */
  firstName?: string | null | undefined;
  /** Family name. */
  lastName?: string | null | undefined;
  /** Password. */
  password: string;
  /** Base of frontend URL that will be needed to create confirmation URL. Required when account confirmation is enabled. */
  redirectUrl?: string | null | undefined;
};

export type CheckoutErrorCode =
  | 'BILLING_ADDRESS_NOT_SET'
  | 'CHECKOUT_NOT_FULLY_PAID'
  | 'DELIVERY_METHOD_NOT_APPLICABLE'
  | 'EMAIL_NOT_SET'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID'
  | 'INVALID_SHIPPING_METHOD'
  | 'NOT_FOUND'
  | 'NO_LINES'
  | 'PRODUCT_NOT_PUBLISHED'
  | 'QUANTITY_GREATER_THAN_LIMIT'
  | 'REQUIRED'
  | 'SHIPPING_ADDRESS_NOT_SET'
  | 'SHIPPING_METHOD_NOT_SET'
  | 'ZERO_QUANTITY';

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

export type AuthUserFragment = { id: string, email: string, firstName: string, lastName: string, isStaff: boolean };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, email: string, firstName: string, lastName: string, isStaff: boolean } | null };

export type TokenCreateMutationVariables = Exact<{
  email: string;
  password: string;
}>;


export type TokenCreateMutation = { tokenCreate: { user: { id: string, email: string, firstName: string, lastName: string, isStaff: boolean } | null, errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { logout: { errors: Array<{ code: AccountErrorCode }> } };

export type AccountRegisterMutationVariables = Exact<{
  input: AccountRegisterInput;
}>;


export type AccountRegisterMutation = { accountRegister: { errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type RequestPasswordResetMutationVariables = Exact<{
  email: string;
  redirectUrl: string;
}>;


export type RequestPasswordResetMutation = { requestPasswordReset: { errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type ConfirmAccountMutationVariables = Exact<{
  email: string;
  token: string;
}>;


export type ConfirmAccountMutation = { confirmAccount: { user: { id: string } | null, errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type SetPasswordMutationVariables = Exact<{
  email: string;
  token: string;
  password: string;
}>;


export type SetPasswordMutation = { setPassword: { user: { id: string, email: string, firstName: string, lastName: string, isStaff: boolean } | null, errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type GuestCheckoutQueryVariables = Exact<{
  id: string | number;
}>;


export type GuestCheckoutQuery = { checkout: { id: string, lines: Array<{ id: string }> } | null };

export type CheckoutCustomerAttachMutationVariables = Exact<{
  id: string | number;
}>;


export type CheckoutCustomerAttachMutation = { checkoutCustomerAttach: { errors: Array<{ code: CheckoutErrorCode }> } | null };

export type MyNewestCheckoutQueryVariables = Exact<{ [key: string]: never; }>;


export type MyNewestCheckoutQuery = { me: { checkouts: { edges: Array<{ node: { token: string } }> } | null } | null };

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
export const AuthUserFragmentDoc = new TypedDocumentString(`
    fragment AuthUser on User {
  id
  email
  firstName
  lastName
  isStaff
}
    `, {"fragmentName":"AuthUser"}) as unknown as TypedDocumentString<AuthUserFragment, unknown>;
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
export const MeDocument = new TypedDocumentString(`
    query Me {
  me {
    ...AuthUser
  }
}
    fragment AuthUser on User {
  id
  email
  firstName
  lastName
  isStaff
}`) as unknown as TypedDocumentString<MeQuery, MeQueryVariables>;
export const TokenCreateDocument = new TypedDocumentString(`
    mutation TokenCreate($email: String!, $password: String!) {
  tokenCreate(email: $email, password: $password) {
    user {
      ...AuthUser
    }
    errors {
      code
      field
    }
  }
}
    fragment AuthUser on User {
  id
  email
  firstName
  lastName
  isStaff
}`) as unknown as TypedDocumentString<TokenCreateMutation, TokenCreateMutationVariables>;
export const LogoutDocument = new TypedDocumentString(`
    mutation Logout {
  logout {
    errors {
      code
    }
  }
}
    `) as unknown as TypedDocumentString<LogoutMutation, LogoutMutationVariables>;
export const AccountRegisterDocument = new TypedDocumentString(`
    mutation AccountRegister($input: AccountRegisterInput!) {
  accountRegister(input: $input) {
    errors {
      code
      field
    }
  }
}
    `) as unknown as TypedDocumentString<AccountRegisterMutation, AccountRegisterMutationVariables>;
export const RequestPasswordResetDocument = new TypedDocumentString(`
    mutation RequestPasswordReset($email: String!, $redirectUrl: String!) {
  requestPasswordReset(email: $email, redirectUrl: $redirectUrl) {
    errors {
      code
      field
    }
  }
}
    `) as unknown as TypedDocumentString<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>;
export const ConfirmAccountDocument = new TypedDocumentString(`
    mutation ConfirmAccount($email: String!, $token: String!) {
  confirmAccount(email: $email, token: $token) {
    user {
      id
    }
    errors {
      code
      field
    }
  }
}
    `) as unknown as TypedDocumentString<ConfirmAccountMutation, ConfirmAccountMutationVariables>;
export const SetPasswordDocument = new TypedDocumentString(`
    mutation SetPassword($email: String!, $token: String!, $password: String!) {
  setPassword(email: $email, token: $token, password: $password) {
    user {
      ...AuthUser
    }
    errors {
      code
      field
    }
  }
}
    fragment AuthUser on User {
  id
  email
  firstName
  lastName
  isStaff
}`) as unknown as TypedDocumentString<SetPasswordMutation, SetPasswordMutationVariables>;
export const GuestCheckoutDocument = new TypedDocumentString(`
    query GuestCheckout($id: ID!) {
  checkout(id: $id) {
    id
    lines {
      id
    }
  }
}
    `) as unknown as TypedDocumentString<GuestCheckoutQuery, GuestCheckoutQueryVariables>;
export const CheckoutCustomerAttachDocument = new TypedDocumentString(`
    mutation CheckoutCustomerAttach($id: ID!) {
  checkoutCustomerAttach(id: $id) {
    errors {
      code
    }
  }
}
    `) as unknown as TypedDocumentString<CheckoutCustomerAttachMutation, CheckoutCustomerAttachMutationVariables>;
export const MyNewestCheckoutDocument = new TypedDocumentString(`
    query MyNewestCheckout {
  me {
    checkouts(first: 1) {
      edges {
        node {
          token
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<MyNewestCheckoutQuery, MyNewestCheckoutQueryVariables>;
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