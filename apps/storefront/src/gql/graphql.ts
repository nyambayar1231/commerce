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

/** Fields required to update the user. */
export type AccountInput = {
  /** Given name. */
  firstName?: string | null | undefined;
  /** Family name. */
  lastName?: string | null | undefined;
};

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

export type AddressInput = {
  /** City. */
  city?: string | null | undefined;
  /** District. */
  cityArea?: string | null | undefined;
  /** Company or organization. */
  companyName?: string | null | undefined;
  /** Country. */
  country?: CountryCode | null | undefined;
  /** State or province. */
  countryArea?: string | null | undefined;
  /** Given name. */
  firstName?: string | null | undefined;
  /** Family name. */
  lastName?: string | null | undefined;
  /** Phone number. */
  phone?: string | null | undefined;
  /** Postal code. */
  postalCode?: string | null | undefined;
  /** Address. */
  streetAddress1?: string | null | undefined;
  /** Address. */
  streetAddress2?: string | null | undefined;
};

export type AddressTypeEnum =
  | 'BILLING'
  | 'SHIPPING';

export type CheckoutChargeStatusEnum =
  | 'FULL'
  | 'NONE'
  | 'OVERCHARGED'
  | 'PARTIAL';

export type CheckoutCreateInput = {
  /** The customer's email address. */
  email?: string | null | undefined;
  /** A list of checkout lines, each containing information about an item in the checkout. */
  lines: Array<CheckoutLineInput>;
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

export type CheckoutLineInput = {
  /** The number of items purchased. */
  quantity: number;
  /** ID of the product variant. */
  variantId: string | number;
};

export type CheckoutLineUpdateInput = {
  /** ID of the line. */
  lineId: string | number;
  /** The number of items purchased. */
  quantity: number;
};

export type CountryCode =
  | 'AD'
  | 'AE'
  | 'AF'
  | 'AG'
  | 'AI'
  | 'AL'
  | 'AM'
  | 'AO'
  | 'AQ'
  | 'AR'
  | 'AS'
  | 'AT'
  | 'AU'
  | 'AW'
  | 'AX'
  | 'AZ'
  | 'BA'
  | 'BB'
  | 'BD'
  | 'BE'
  | 'BF'
  | 'BG'
  | 'BH'
  | 'BI'
  | 'BJ'
  | 'BL'
  | 'BM'
  | 'BN'
  | 'BO'
  | 'BQ'
  | 'BR'
  | 'BS'
  | 'BT'
  | 'BV'
  | 'BW'
  | 'BY'
  | 'BZ'
  | 'CA'
  | 'CC'
  | 'CD'
  | 'CF'
  | 'CG'
  | 'CH'
  | 'CI'
  | 'CK'
  | 'CL'
  | 'CM'
  | 'CN'
  | 'CO'
  | 'CR'
  | 'CU'
  | 'CV'
  | 'CW'
  | 'CX'
  | 'CY'
  | 'CZ'
  | 'DE'
  | 'DJ'
  | 'DK'
  | 'DM'
  | 'DO'
  | 'DZ'
  | 'EC'
  | 'EE'
  | 'EG'
  | 'EH'
  | 'ER'
  | 'ES'
  | 'ET'
  | 'EU'
  | 'FI'
  | 'FJ'
  | 'FK'
  | 'FM'
  | 'FO'
  | 'FR'
  | 'GA'
  | 'GB'
  | 'GD'
  | 'GE'
  | 'GF'
  | 'GG'
  | 'GH'
  | 'GI'
  | 'GL'
  | 'GM'
  | 'GN'
  | 'GP'
  | 'GQ'
  | 'GR'
  | 'GS'
  | 'GT'
  | 'GU'
  | 'GW'
  | 'GY'
  | 'HK'
  | 'HM'
  | 'HN'
  | 'HR'
  | 'HT'
  | 'HU'
  | 'ID'
  | 'IE'
  | 'IL'
  | 'IM'
  | 'IN'
  | 'IO'
  | 'IQ'
  | 'IR'
  | 'IS'
  | 'IT'
  | 'JE'
  | 'JM'
  | 'JO'
  | 'JP'
  | 'KE'
  | 'KG'
  | 'KH'
  | 'KI'
  | 'KM'
  | 'KN'
  | 'KP'
  | 'KR'
  | 'KW'
  | 'KY'
  | 'KZ'
  | 'LA'
  | 'LB'
  | 'LC'
  | 'LI'
  | 'LK'
  | 'LR'
  | 'LS'
  | 'LT'
  | 'LU'
  | 'LV'
  | 'LY'
  | 'MA'
  | 'MC'
  | 'MD'
  | 'ME'
  | 'MF'
  | 'MG'
  | 'MH'
  | 'MK'
  | 'ML'
  | 'MM'
  | 'MN'
  | 'MO'
  | 'MP'
  | 'MQ'
  | 'MR'
  | 'MS'
  | 'MT'
  | 'MU'
  | 'MV'
  | 'MW'
  | 'MX'
  | 'MY'
  | 'MZ'
  | 'NA'
  | 'NC'
  | 'NE'
  | 'NF'
  | 'NG'
  | 'NI'
  | 'NL'
  | 'NO'
  | 'NP'
  | 'NR'
  | 'NU'
  | 'NZ'
  | 'OM'
  | 'PA'
  | 'PE'
  | 'PF'
  | 'PG'
  | 'PH'
  | 'PK'
  | 'PL'
  | 'PM'
  | 'PN'
  | 'PR'
  | 'PS'
  | 'PT'
  | 'PW'
  | 'PY'
  | 'QA'
  | 'RE'
  | 'RO'
  | 'RS'
  | 'RU'
  | 'RW'
  | 'SA'
  | 'SB'
  | 'SC'
  | 'SD'
  | 'SE'
  | 'SG'
  | 'SH'
  | 'SI'
  | 'SJ'
  | 'SK'
  | 'SL'
  | 'SM'
  | 'SN'
  | 'SO'
  | 'SR'
  | 'SS'
  | 'ST'
  | 'SV'
  | 'SX'
  | 'SY'
  | 'SZ'
  | 'TC'
  | 'TD'
  | 'TF'
  | 'TG'
  | 'TH'
  | 'TJ'
  | 'TK'
  | 'TL'
  | 'TM'
  | 'TN'
  | 'TO'
  | 'TR'
  | 'TT'
  | 'TV'
  | 'TW'
  | 'TZ'
  | 'UA'
  | 'UG'
  | 'UM'
  | 'US'
  | 'UY'
  | 'UZ'
  | 'VA'
  | 'VC'
  | 'VE'
  | 'VG'
  | 'VI'
  | 'VN'
  | 'VU'
  | 'WF'
  | 'WS'
  | 'XK'
  | 'YE'
  | 'YT'
  | 'ZA'
  | 'ZM'
  | 'ZW';

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

export type FulfillmentStatus =
  | 'CANCELED'
  | 'FULFILLED'
  | 'REFUNDED'
  | 'REFUNDED_AND_RETURNED'
  | 'REPLACED'
  | 'RETURNED'
  | 'WAITING_FOR_APPROVAL';

export type GlobalIdFilterInput = {
  /** The value equal to. */
  eq?: string | number | null | undefined;
  /** The value included in. */
  oneOf?: Array<string | number> | null | undefined;
};

export type OrderChargeStatusEnum =
  | 'FULL'
  | 'NONE'
  | 'OVERCHARGED'
  | 'PARTIAL';

export type OrderDirection =
  /** Specifies an ascending sort order. */
  | 'ASC'
  /** Specifies a descending sort order. */
  | 'DESC';

export type OrderStatus =
  | 'CANCELED'
  | 'DRAFT'
  | 'FULFILLED'
  | 'PARTIALLY_FULFILLED'
  | 'UNFULFILLED';

export type ProductMediaType =
  /** An uploaded image or an URL to an image */
  | 'IMAGE'
  /** A URL to an external video */
  | 'VIDEO';

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

export type TransactionEventTypeEnum =
  | 'AUTHORIZATION_ACTION_REQUIRED'
  | 'AUTHORIZATION_ADJUSTMENT'
  | 'AUTHORIZATION_FAILURE'
  | 'AUTHORIZATION_REQUEST'
  | 'AUTHORIZATION_SUCCESS'
  | 'CANCEL_FAILURE'
  | 'CANCEL_REQUEST'
  | 'CANCEL_SUCCESS'
  | 'CHARGE_ACTION_REQUIRED'
  | 'CHARGE_BACK'
  | 'CHARGE_FAILURE'
  | 'CHARGE_REQUEST'
  | 'CHARGE_SUCCESS'
  | 'INFO'
  | 'REFUND_FAILURE'
  | 'REFUND_REQUEST'
  | 'REFUND_REVERSE'
  | 'REFUND_SUCCESS';

export type TransactionInitializeErrorCode =
  | 'GRAPHQL_ERROR'
  | 'INVALID'
  | 'NOT_FOUND'
  | 'UNIQUE';

export type AccountAddressFragment = { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } };

export type AccountOrderSummaryFragment = { id: string, number: string, created: string, status: OrderStatus, total: { gross: { amount: number, currency: string } }, lines: Array<{ id: string, quantity: number }> };

export type AccountOrderDetailFragment = { id: string, number: string, created: string, updatedAt: string, status: OrderStatus, chargeStatus: OrderChargeStatusEnum, shippingMethodName: string | null, lines: Array<{ id: string, productName: string, variantName: string, quantity: number, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotal: { gross: { amount: number, currency: string } }, shippingPrice: { gross: { amount: number, currency: string } }, total: { gross: { amount: number, currency: string } }, shippingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, billingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, fulfillments: Array<{ id: string, created: string, status: FulfillmentStatus, trackingNumber: string, lines: Array<{ quantity: number }> | null }> };

export type AccountOverviewQueryVariables = Exact<{ [key: string]: never; }>;


export type AccountOverviewQuery = { me: { id: string, defaultShippingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, defaultBillingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, orders: { edges: Array<{ node: { id: string, number: string, created: string, status: OrderStatus, total: { gross: { amount: number, currency: string } }, lines: Array<{ id: string, quantity: number }> } }> } | null } | null };

export type AccountOrdersQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
  last?: number | null | undefined;
  before?: string | null | undefined;
}>;


export type AccountOrdersQuery = { me: { id: string, orders: { edges: Array<{ node: { id: string, number: string, created: string, status: OrderStatus, total: { gross: { amount: number, currency: string } }, lines: Array<{ id: string, quantity: number }> } }>, pageInfo: { hasNextPage: boolean, hasPreviousPage: boolean, startCursor: string | null, endCursor: string | null } } | null } | null };

export type AccountOrderQueryVariables = Exact<{
  id: string | number;
}>;


export type AccountOrderQuery = { order: { id: string, number: string, created: string, updatedAt: string, status: OrderStatus, chargeStatus: OrderChargeStatusEnum, shippingMethodName: string | null, lines: Array<{ id: string, productName: string, variantName: string, quantity: number, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotal: { gross: { amount: number, currency: string } }, shippingPrice: { gross: { amount: number, currency: string } }, total: { gross: { amount: number, currency: string } }, shippingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, billingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, fulfillments: Array<{ id: string, created: string, status: FulfillmentStatus, trackingNumber: string, lines: Array<{ quantity: number }> | null }> } | null };

export type AccountAddressesQueryVariables = Exact<{ [key: string]: never; }>;


export type AccountAddressesQuery = { me: { id: string, addresses: Array<{ id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } }> } | null, shop: { countries: Array<{ code: string, country: string }> } };

export type AccountAddressCreateMutationVariables = Exact<{
  input: AddressInput;
}>;


export type AccountAddressCreateMutation = { accountAddressCreate: { errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type AccountAddressUpdateMutationVariables = Exact<{
  id: string | number;
  input: AddressInput;
}>;


export type AccountAddressUpdateMutation = { accountAddressUpdate: { errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type AccountAddressDeleteMutationVariables = Exact<{
  id: string | number;
}>;


export type AccountAddressDeleteMutation = { accountAddressDelete: { errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type AccountSetDefaultAddressMutationVariables = Exact<{
  id: string | number;
  type: AddressTypeEnum;
}>;


export type AccountSetDefaultAddressMutation = { accountSetDefaultAddress: { errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type AccountUpdateMutationVariables = Exact<{
  input: AccountInput;
}>;


export type AccountUpdateMutation = { accountUpdate: { errors: Array<{ code: AccountErrorCode, field: string | null }> } };

export type PasswordChangeMutationVariables = Exact<{
  oldPassword: string;
  newPassword: string;
}>;


export type PasswordChangeMutation = { passwordChange: { errors: Array<{ code: AccountErrorCode, field: string | null }> } };

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

export type CartFragment = { id: string, token: string, quantity: number, isShippingRequired: boolean, lines: Array<{ id: string, quantity: number, variant: { id: string, name: string, quantityAvailable: number | null, product: { name: string, slug: string, thumbnail: { url: string, alt: string | null } | null } }, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotalPrice: { gross: { amount: number, currency: string } } };

export type CartByTokenQueryVariables = Exact<{
  id: string | number;
}>;


export type CartByTokenQuery = { checkout: { id: string, token: string, quantity: number, isShippingRequired: boolean, lines: Array<{ id: string, quantity: number, variant: { id: string, name: string, quantityAvailable: number | null, product: { name: string, slug: string, thumbnail: { url: string, alt: string | null } | null } }, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotalPrice: { gross: { amount: number, currency: string } } } | null };

export type CheckoutCreateMutationVariables = Exact<{
  input: CheckoutCreateInput;
}>;


export type CheckoutCreateMutation = { checkoutCreate: { checkout: { id: string, token: string, quantity: number, isShippingRequired: boolean, lines: Array<{ id: string, quantity: number, variant: { id: string, name: string, quantityAvailable: number | null, product: { name: string, slug: string, thumbnail: { url: string, alt: string | null } | null } }, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotalPrice: { gross: { amount: number, currency: string } } } | null, errors: Array<{ field: string | null, code: CheckoutErrorCode, message: string }> } | null };

export type CheckoutLinesAddMutationVariables = Exact<{
  id: string | number;
  lines: Array<CheckoutLineInput> | CheckoutLineInput;
}>;


export type CheckoutLinesAddMutation = { checkoutLinesAdd: { checkout: { id: string, token: string, quantity: number, isShippingRequired: boolean, lines: Array<{ id: string, quantity: number, variant: { id: string, name: string, quantityAvailable: number | null, product: { name: string, slug: string, thumbnail: { url: string, alt: string | null } | null } }, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotalPrice: { gross: { amount: number, currency: string } } } | null, errors: Array<{ field: string | null, code: CheckoutErrorCode, message: string }> } | null };

export type CheckoutLinesUpdateMutationVariables = Exact<{
  id: string | number;
  lines: Array<CheckoutLineUpdateInput> | CheckoutLineUpdateInput;
}>;


export type CheckoutLinesUpdateMutation = { checkoutLinesUpdate: { checkout: { id: string, token: string, quantity: number, isShippingRequired: boolean, lines: Array<{ id: string, quantity: number, variant: { id: string, name: string, quantityAvailable: number | null, product: { name: string, slug: string, thumbnail: { url: string, alt: string | null } | null } }, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotalPrice: { gross: { amount: number, currency: string } } } | null, errors: Array<{ field: string | null, code: CheckoutErrorCode, message: string }> } | null };

export type CheckoutLinesDeleteMutationVariables = Exact<{
  id: string | number;
  linesIds: Array<string | number> | string | number;
}>;


export type CheckoutLinesDeleteMutation = { checkoutLinesDelete: { checkout: { id: string, token: string, quantity: number, isShippingRequired: boolean, lines: Array<{ id: string, quantity: number, variant: { id: string, name: string, quantityAvailable: number | null, product: { name: string, slug: string, thumbnail: { url: string, alt: string | null } | null } }, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotalPrice: { gross: { amount: number, currency: string } } } | null, errors: Array<{ field: string | null, code: CheckoutErrorCode, message: string }> } | null };

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

export type CheckoutDetailsFragment = { email: string | null, chargeStatus: CheckoutChargeStatusEnum, id: string, token: string, quantity: number, isShippingRequired: boolean, shippingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, billingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, delivery: { shippingMethod: { id: string } | null } | null, shippingMethods: Array<{ id: string, name: string, active: boolean, message: string | null, price: { amount: number, currency: string } }>, shippingPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } }, totalBalance: { amount: number, currency: string }, lines: Array<{ id: string, quantity: number, variant: { id: string, name: string, quantityAvailable: number | null, product: { name: string, slug: string, thumbnail: { url: string, alt: string | null } | null } }, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotalPrice: { gross: { amount: number, currency: string } } };

export type CheckoutDetailsQueryVariables = Exact<{
  id: string | number;
}>;


export type CheckoutDetailsQuery = { checkout: { email: string | null, chargeStatus: CheckoutChargeStatusEnum, id: string, token: string, quantity: number, isShippingRequired: boolean, shippingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, billingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, delivery: { shippingMethod: { id: string } | null } | null, shippingMethods: Array<{ id: string, name: string, active: boolean, message: string | null, price: { amount: number, currency: string } }>, shippingPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } }, totalBalance: { amount: number, currency: string }, lines: Array<{ id: string, quantity: number, variant: { id: string, name: string, quantityAvailable: number | null, product: { name: string, slug: string, thumbnail: { url: string, alt: string | null } | null } }, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotalPrice: { gross: { amount: number, currency: string } } } | null };

export type CheckoutCountriesQueryVariables = Exact<{ [key: string]: never; }>;


export type CheckoutCountriesQuery = { shop: { countries: Array<{ code: string, country: string }> } };

export type CheckoutSavedAddressesQueryVariables = Exact<{ [key: string]: never; }>;


export type CheckoutSavedAddressesQuery = { me: { id: string, addresses: Array<{ id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } }> } | null };

export type CheckoutPaymentStateQueryVariables = Exact<{
  id: string | number;
}>;


export type CheckoutPaymentStateQuery = { checkout: { id: string, email: string | null, chargeStatus: CheckoutChargeStatusEnum, lines: Array<{ id: string }>, shippingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, billingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, delivery: { shippingMethod: { id: string } | null } | null } | null };

export type CheckoutEmailUpdateMutationVariables = Exact<{
  id: string | number;
  email: string;
}>;


export type CheckoutEmailUpdateMutation = { checkoutEmailUpdate: { checkout: { id: string } | null, errors: Array<{ field: string | null, code: CheckoutErrorCode, message: string }> } | null };

export type CheckoutShippingAddressUpdateMutationVariables = Exact<{
  id: string | number;
  address: AddressInput;
}>;


export type CheckoutShippingAddressUpdateMutation = { checkoutShippingAddressUpdate: { checkout: { id: string } | null, errors: Array<{ field: string | null, code: CheckoutErrorCode, message: string }> } | null };

export type CheckoutBillingAddressUpdateMutationVariables = Exact<{
  id: string | number;
  address: AddressInput;
}>;


export type CheckoutBillingAddressUpdateMutation = { checkoutBillingAddressUpdate: { checkout: { id: string } | null, errors: Array<{ field: string | null, code: CheckoutErrorCode, message: string }> } | null };

export type CheckoutDeliveryMethodUpdateMutationVariables = Exact<{
  id: string | number;
  deliveryMethodId: string | number;
}>;


export type CheckoutDeliveryMethodUpdateMutation = { checkoutDeliveryMethodUpdate: { checkout: { id: string } | null, errors: Array<{ field: string | null, code: CheckoutErrorCode, message: string }> } | null };

export type TransactionInitializeMutationVariables = Exact<{
  id: string | number;
  gatewayId: string;
  data?: unknown;
  idempotencyKey: string;
}>;


export type TransactionInitializeMutation = { transactionInitialize: { transaction: { id: string } | null, transactionEvent: { type: TransactionEventTypeEnum | null } | null, errors: Array<{ field: string | null, code: TransactionInitializeErrorCode, message: string }> } | null };

export type CheckoutCompleteMutationVariables = Exact<{
  id: string | number;
}>;


export type CheckoutCompleteMutation = { checkoutComplete: { order: { id: string, token: string } | null, errors: Array<{ field: string | null, code: CheckoutErrorCode, message: string }> } | null };

export type OrderByTokenQueryVariables = Exact<{
  token: string;
}>;


export type OrderByTokenQuery = { orderByToken: { userEmail: string | null, id: string, number: string, created: string, updatedAt: string, status: OrderStatus, chargeStatus: OrderChargeStatusEnum, shippingMethodName: string | null, lines: Array<{ id: string, productName: string, variantName: string, quantity: number, unitPrice: { gross: { amount: number, currency: string } }, totalPrice: { gross: { amount: number, currency: string } } }>, subtotal: { gross: { amount: number, currency: string } }, shippingPrice: { gross: { amount: number, currency: string } }, total: { gross: { amount: number, currency: string } }, shippingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, billingAddress: { id: string | null, firstName: string, lastName: string, companyName: string, streetAddress1: string, streetAddress2: string, city: string, cityArea: string, postalCode: string, countryArea: string, phone: string | null, isDefaultShippingAddress: boolean | null, isDefaultBillingAddress: boolean | null, country: { code: string, country: string } } | null, fulfillments: Array<{ id: string, created: string, status: FulfillmentStatus, trackingNumber: string, lines: Array<{ quantity: number }> | null }> } | null };

export type MenuBySlugQueryVariables = Exact<{
  slug: string;
}>;


export type MenuBySlugQuery = { menu: { items: Array<{ id: string, name: string, url: string | null, category: { slug: string } | null, collection: { slug: string } | null, page: { slug: string } | null, children: Array<{ id: string, name: string, url: string | null, category: { slug: string } | null, collection: { slug: string } | null, page: { slug: string } | null, children: Array<{ id: string, name: string, url: string | null, category: { slug: string } | null, collection: { slug: string } | null, page: { slug: string } | null }> }> }> } | null };

export type PageBySlugQueryVariables = Exact<{
  slug: string;
}>;


export type PageBySlugQuery = { page: { title: string, slug: string, content: string | null } | null };

export type FeaturedCollectionQueryVariables = Exact<{
  slug: string;
}>;


export type FeaturedCollectionQuery = { collection: { name: string, products: { edges: Array<{ node: { id: string, name: string, slug: string, category: { name: string } | null, small: { url: string, alt: string | null } | null, large: { url: string } | null, minimalVariantPrice: { amount: number, currency: string } | null, variants: Array<{ id: string, quantityAvailable: number | null, price: { amount: number } }> } }> } | null } | null };

export type HomeCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type HomeCategoriesQuery = { categories: { edges: Array<{ node: { name: string, slug: string } }> } | null };

export type ProductSearchQueryVariables = Exact<{
  q: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
  last?: number | null | undefined;
  before?: string | null | undefined;
}>;


export type ProductSearchQuery = { products: { totalCount: number | null, edges: Array<{ cursor: string, node: { id: string, name: string, slug: string, category: { name: string } | null, small: { url: string, alt: string | null } | null, large: { url: string } | null, minimalVariantPrice: { amount: number, currency: string } | null, variants: Array<{ id: string, quantityAvailable: number | null, price: { amount: number } }> } }>, pageInfo: { hasNextPage: boolean, hasPreviousPage: boolean, startCursor: string | null, endCursor: string | null } } | null };

export type ProductDetailsQueryVariables = Exact<{
  slug: string;
}>;


export type ProductDetailsQuery = { product: { id: string, name: string, slug: string, description: string | null, updatedAt: string, category: { name: string, slug: string, ancestors: { edges: Array<{ node: { name: string, slug: string } }> } | null } | null, media: Array<{ id: string, alt: string, type: ProductMediaType, thumb: string, medium: string, large: string }>, variants: Array<{ id: string, name: string, sku: string | null, quantityAvailable: number | null, price: { amount: number, currency: string }, media: Array<{ id: string }> }> } | null };

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
export const AccountOrderSummaryFragmentDoc = new TypedDocumentString(`
    fragment AccountOrderSummary on Order {
  id
  number
  created
  status
  total {
    gross {
      amount
      currency
    }
  }
  lines {
    id
    quantity
  }
}
    `, {"fragmentName":"AccountOrderSummary"}) as unknown as TypedDocumentString<AccountOrderSummaryFragment, unknown>;
export const AccountAddressFragmentDoc = new TypedDocumentString(`
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}
    `, {"fragmentName":"AccountAddress"}) as unknown as TypedDocumentString<AccountAddressFragment, unknown>;
export const AccountOrderDetailFragmentDoc = new TypedDocumentString(`
    fragment AccountOrderDetail on Order {
  id
  number
  created
  updatedAt
  status
  chargeStatus
  shippingMethodName
  lines {
    id
    productName
    variantName
    quantity
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotal {
    gross {
      amount
      currency
    }
  }
  shippingPrice {
    gross {
      amount
      currency
    }
  }
  total {
    gross {
      amount
      currency
    }
  }
  shippingAddress {
    ...AccountAddress
  }
  billingAddress {
    ...AccountAddress
  }
  fulfillments {
    id
    created
    status
    trackingNumber
    lines {
      quantity
    }
  }
}
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}`, {"fragmentName":"AccountOrderDetail"}) as unknown as TypedDocumentString<AccountOrderDetailFragment, unknown>;
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
export const CartFragmentDoc = new TypedDocumentString(`
    fragment Cart on Checkout {
  id
  token
  quantity
  isShippingRequired
  lines {
    id
    quantity
    variant {
      id
      name
      quantityAvailable
      product {
        name
        slug
        thumbnail(size: 256, format: WEBP) {
          url
          alt
        }
      }
    }
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotalPrice {
    gross {
      amount
      currency
    }
  }
}
    `, {"fragmentName":"Cart"}) as unknown as TypedDocumentString<CartFragment, unknown>;
export const CheckoutDetailsFragmentDoc = new TypedDocumentString(`
    fragment CheckoutDetails on Checkout {
  ...Cart
  email
  shippingAddress {
    ...AccountAddress
  }
  billingAddress {
    ...AccountAddress
  }
  delivery {
    shippingMethod {
      id
    }
  }
  shippingMethods {
    id
    name
    active
    message
    price {
      amount
      currency
    }
  }
  shippingPrice {
    gross {
      amount
      currency
    }
  }
  totalPrice {
    gross {
      amount
      currency
    }
  }
  totalBalance {
    amount
    currency
  }
  chargeStatus
}
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}
fragment Cart on Checkout {
  id
  token
  quantity
  isShippingRequired
  lines {
    id
    quantity
    variant {
      id
      name
      quantityAvailable
      product {
        name
        slug
        thumbnail(size: 256, format: WEBP) {
          url
          alt
        }
      }
    }
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotalPrice {
    gross {
      amount
      currency
    }
  }
}`, {"fragmentName":"CheckoutDetails"}) as unknown as TypedDocumentString<CheckoutDetailsFragment, unknown>;
export const AccountOverviewDocument = new TypedDocumentString(`
    query AccountOverview {
  me {
    id
    defaultShippingAddress {
      ...AccountAddress
    }
    defaultBillingAddress {
      ...AccountAddress
    }
    orders(first: 3) {
      edges {
        node {
          ...AccountOrderSummary
        }
      }
    }
  }
}
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}
fragment AccountOrderSummary on Order {
  id
  number
  created
  status
  total {
    gross {
      amount
      currency
    }
  }
  lines {
    id
    quantity
  }
}`) as unknown as TypedDocumentString<AccountOverviewQuery, AccountOverviewQueryVariables>;
export const AccountOrdersDocument = new TypedDocumentString(`
    query AccountOrders($first: Int, $after: String, $last: Int, $before: String) {
  me {
    id
    orders(first: $first, after: $after, last: $last, before: $before) {
      edges {
        node {
          ...AccountOrderSummary
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
}
    fragment AccountOrderSummary on Order {
  id
  number
  created
  status
  total {
    gross {
      amount
      currency
    }
  }
  lines {
    id
    quantity
  }
}`) as unknown as TypedDocumentString<AccountOrdersQuery, AccountOrdersQueryVariables>;
export const AccountOrderDocument = new TypedDocumentString(`
    query AccountOrder($id: ID!) {
  order(id: $id) {
    ...AccountOrderDetail
  }
}
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}
fragment AccountOrderDetail on Order {
  id
  number
  created
  updatedAt
  status
  chargeStatus
  shippingMethodName
  lines {
    id
    productName
    variantName
    quantity
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotal {
    gross {
      amount
      currency
    }
  }
  shippingPrice {
    gross {
      amount
      currency
    }
  }
  total {
    gross {
      amount
      currency
    }
  }
  shippingAddress {
    ...AccountAddress
  }
  billingAddress {
    ...AccountAddress
  }
  fulfillments {
    id
    created
    status
    trackingNumber
    lines {
      quantity
    }
  }
}`) as unknown as TypedDocumentString<AccountOrderQuery, AccountOrderQueryVariables>;
export const AccountAddressesDocument = new TypedDocumentString(`
    query AccountAddresses {
  me {
    id
    addresses {
      ...AccountAddress
    }
  }
  shop {
    countries {
      code
      country
    }
  }
}
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}`) as unknown as TypedDocumentString<AccountAddressesQuery, AccountAddressesQueryVariables>;
export const AccountAddressCreateDocument = new TypedDocumentString(`
    mutation AccountAddressCreate($input: AddressInput!) {
  accountAddressCreate(input: $input) {
    errors {
      code
      field
    }
  }
}
    `) as unknown as TypedDocumentString<AccountAddressCreateMutation, AccountAddressCreateMutationVariables>;
export const AccountAddressUpdateDocument = new TypedDocumentString(`
    mutation AccountAddressUpdate($id: ID!, $input: AddressInput!) {
  accountAddressUpdate(id: $id, input: $input) {
    errors {
      code
      field
    }
  }
}
    `) as unknown as TypedDocumentString<AccountAddressUpdateMutation, AccountAddressUpdateMutationVariables>;
export const AccountAddressDeleteDocument = new TypedDocumentString(`
    mutation AccountAddressDelete($id: ID!) {
  accountAddressDelete(id: $id) {
    errors {
      code
      field
    }
  }
}
    `) as unknown as TypedDocumentString<AccountAddressDeleteMutation, AccountAddressDeleteMutationVariables>;
export const AccountSetDefaultAddressDocument = new TypedDocumentString(`
    mutation AccountSetDefaultAddress($id: ID!, $type: AddressTypeEnum!) {
  accountSetDefaultAddress(id: $id, type: $type) {
    errors {
      code
      field
    }
  }
}
    `) as unknown as TypedDocumentString<AccountSetDefaultAddressMutation, AccountSetDefaultAddressMutationVariables>;
export const AccountUpdateDocument = new TypedDocumentString(`
    mutation AccountUpdate($input: AccountInput!) {
  accountUpdate(input: $input) {
    errors {
      code
      field
    }
  }
}
    `) as unknown as TypedDocumentString<AccountUpdateMutation, AccountUpdateMutationVariables>;
export const PasswordChangeDocument = new TypedDocumentString(`
    mutation PasswordChange($oldPassword: String!, $newPassword: String!) {
  passwordChange(oldPassword: $oldPassword, newPassword: $newPassword) {
    errors {
      code
      field
    }
  }
}
    `) as unknown as TypedDocumentString<PasswordChangeMutation, PasswordChangeMutationVariables>;
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
export const CartByTokenDocument = new TypedDocumentString(`
    query CartByToken($id: ID!) {
  checkout(id: $id) {
    ...Cart
  }
}
    fragment Cart on Checkout {
  id
  token
  quantity
  isShippingRequired
  lines {
    id
    quantity
    variant {
      id
      name
      quantityAvailable
      product {
        name
        slug
        thumbnail(size: 256, format: WEBP) {
          url
          alt
        }
      }
    }
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotalPrice {
    gross {
      amount
      currency
    }
  }
}`) as unknown as TypedDocumentString<CartByTokenQuery, CartByTokenQueryVariables>;
export const CheckoutCreateDocument = new TypedDocumentString(`
    mutation CheckoutCreate($input: CheckoutCreateInput!) {
  checkoutCreate(input: $input) {
    checkout {
      ...Cart
    }
    errors {
      field
      code
      message
    }
  }
}
    fragment Cart on Checkout {
  id
  token
  quantity
  isShippingRequired
  lines {
    id
    quantity
    variant {
      id
      name
      quantityAvailable
      product {
        name
        slug
        thumbnail(size: 256, format: WEBP) {
          url
          alt
        }
      }
    }
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotalPrice {
    gross {
      amount
      currency
    }
  }
}`) as unknown as TypedDocumentString<CheckoutCreateMutation, CheckoutCreateMutationVariables>;
export const CheckoutLinesAddDocument = new TypedDocumentString(`
    mutation CheckoutLinesAdd($id: ID!, $lines: [CheckoutLineInput!]!) {
  checkoutLinesAdd(id: $id, lines: $lines) {
    checkout {
      ...Cart
    }
    errors {
      field
      code
      message
    }
  }
}
    fragment Cart on Checkout {
  id
  token
  quantity
  isShippingRequired
  lines {
    id
    quantity
    variant {
      id
      name
      quantityAvailable
      product {
        name
        slug
        thumbnail(size: 256, format: WEBP) {
          url
          alt
        }
      }
    }
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotalPrice {
    gross {
      amount
      currency
    }
  }
}`) as unknown as TypedDocumentString<CheckoutLinesAddMutation, CheckoutLinesAddMutationVariables>;
export const CheckoutLinesUpdateDocument = new TypedDocumentString(`
    mutation CheckoutLinesUpdate($id: ID!, $lines: [CheckoutLineUpdateInput!]!) {
  checkoutLinesUpdate(id: $id, lines: $lines) {
    checkout {
      ...Cart
    }
    errors {
      field
      code
      message
    }
  }
}
    fragment Cart on Checkout {
  id
  token
  quantity
  isShippingRequired
  lines {
    id
    quantity
    variant {
      id
      name
      quantityAvailable
      product {
        name
        slug
        thumbnail(size: 256, format: WEBP) {
          url
          alt
        }
      }
    }
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotalPrice {
    gross {
      amount
      currency
    }
  }
}`) as unknown as TypedDocumentString<CheckoutLinesUpdateMutation, CheckoutLinesUpdateMutationVariables>;
export const CheckoutLinesDeleteDocument = new TypedDocumentString(`
    mutation CheckoutLinesDelete($id: ID!, $linesIds: [ID!]!) {
  checkoutLinesDelete(id: $id, linesIds: $linesIds) {
    checkout {
      ...Cart
    }
    errors {
      field
      code
      message
    }
  }
}
    fragment Cart on Checkout {
  id
  token
  quantity
  isShippingRequired
  lines {
    id
    quantity
    variant {
      id
      name
      quantityAvailable
      product {
        name
        slug
        thumbnail(size: 256, format: WEBP) {
          url
          alt
        }
      }
    }
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotalPrice {
    gross {
      amount
      currency
    }
  }
}`) as unknown as TypedDocumentString<CheckoutLinesDeleteMutation, CheckoutLinesDeleteMutationVariables>;
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
export const CheckoutDetailsDocument = new TypedDocumentString(`
    query CheckoutDetails($id: ID!) {
  checkout(id: $id) {
    ...CheckoutDetails
  }
}
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}
fragment Cart on Checkout {
  id
  token
  quantity
  isShippingRequired
  lines {
    id
    quantity
    variant {
      id
      name
      quantityAvailable
      product {
        name
        slug
        thumbnail(size: 256, format: WEBP) {
          url
          alt
        }
      }
    }
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotalPrice {
    gross {
      amount
      currency
    }
  }
}
fragment CheckoutDetails on Checkout {
  ...Cart
  email
  shippingAddress {
    ...AccountAddress
  }
  billingAddress {
    ...AccountAddress
  }
  delivery {
    shippingMethod {
      id
    }
  }
  shippingMethods {
    id
    name
    active
    message
    price {
      amount
      currency
    }
  }
  shippingPrice {
    gross {
      amount
      currency
    }
  }
  totalPrice {
    gross {
      amount
      currency
    }
  }
  totalBalance {
    amount
    currency
  }
  chargeStatus
}`) as unknown as TypedDocumentString<CheckoutDetailsQuery, CheckoutDetailsQueryVariables>;
export const CheckoutCountriesDocument = new TypedDocumentString(`
    query CheckoutCountries {
  shop {
    countries {
      code
      country
    }
  }
}
    `) as unknown as TypedDocumentString<CheckoutCountriesQuery, CheckoutCountriesQueryVariables>;
export const CheckoutSavedAddressesDocument = new TypedDocumentString(`
    query CheckoutSavedAddresses {
  me {
    id
    addresses {
      ...AccountAddress
    }
  }
}
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}`) as unknown as TypedDocumentString<CheckoutSavedAddressesQuery, CheckoutSavedAddressesQueryVariables>;
export const CheckoutPaymentStateDocument = new TypedDocumentString(`
    query CheckoutPaymentState($id: ID!) {
  checkout(id: $id) {
    id
    email
    chargeStatus
    lines {
      id
    }
    shippingAddress {
      ...AccountAddress
    }
    billingAddress {
      ...AccountAddress
    }
    delivery {
      shippingMethod {
        id
      }
    }
  }
}
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}`) as unknown as TypedDocumentString<CheckoutPaymentStateQuery, CheckoutPaymentStateQueryVariables>;
export const CheckoutEmailUpdateDocument = new TypedDocumentString(`
    mutation CheckoutEmailUpdate($id: ID!, $email: String!) {
  checkoutEmailUpdate(id: $id, email: $email) {
    checkout {
      id
    }
    errors {
      field
      code
      message
    }
  }
}
    `) as unknown as TypedDocumentString<CheckoutEmailUpdateMutation, CheckoutEmailUpdateMutationVariables>;
export const CheckoutShippingAddressUpdateDocument = new TypedDocumentString(`
    mutation CheckoutShippingAddressUpdate($id: ID!, $address: AddressInput!) {
  checkoutShippingAddressUpdate(id: $id, shippingAddress: $address) {
    checkout {
      id
    }
    errors {
      field
      code
      message
    }
  }
}
    `) as unknown as TypedDocumentString<CheckoutShippingAddressUpdateMutation, CheckoutShippingAddressUpdateMutationVariables>;
export const CheckoutBillingAddressUpdateDocument = new TypedDocumentString(`
    mutation CheckoutBillingAddressUpdate($id: ID!, $address: AddressInput!) {
  checkoutBillingAddressUpdate(id: $id, billingAddress: $address) {
    checkout {
      id
    }
    errors {
      field
      code
      message
    }
  }
}
    `) as unknown as TypedDocumentString<CheckoutBillingAddressUpdateMutation, CheckoutBillingAddressUpdateMutationVariables>;
export const CheckoutDeliveryMethodUpdateDocument = new TypedDocumentString(`
    mutation CheckoutDeliveryMethodUpdate($id: ID!, $deliveryMethodId: ID!) {
  checkoutDeliveryMethodUpdate(id: $id, deliveryMethodId: $deliveryMethodId) {
    checkout {
      id
    }
    errors {
      field
      code
      message
    }
  }
}
    `) as unknown as TypedDocumentString<CheckoutDeliveryMethodUpdateMutation, CheckoutDeliveryMethodUpdateMutationVariables>;
export const TransactionInitializeDocument = new TypedDocumentString(`
    mutation TransactionInitialize($id: ID!, $gatewayId: String!, $data: JSON, $idempotencyKey: String!) {
  transactionInitialize(
    id: $id
    action: CHARGE
    paymentGateway: {id: $gatewayId, data: $data}
    idempotencyKey: $idempotencyKey
  ) {
    transaction {
      id
    }
    transactionEvent {
      type
    }
    errors {
      field
      code
      message
    }
  }
}
    `) as unknown as TypedDocumentString<TransactionInitializeMutation, TransactionInitializeMutationVariables>;
export const CheckoutCompleteDocument = new TypedDocumentString(`
    mutation CheckoutComplete($id: ID!) {
  checkoutComplete(id: $id) {
    order {
      id
      token
    }
    errors {
      field
      code
      message
    }
  }
}
    `) as unknown as TypedDocumentString<CheckoutCompleteMutation, CheckoutCompleteMutationVariables>;
export const OrderByTokenDocument = new TypedDocumentString(`
    query OrderByToken($token: UUID!) {
  orderByToken(token: $token) {
    ...AccountOrderDetail
    userEmail
  }
}
    fragment AccountAddress on Address {
  id
  firstName
  lastName
  companyName
  streetAddress1
  streetAddress2
  city
  cityArea
  postalCode
  countryArea
  phone
  country {
    code
    country
  }
  isDefaultShippingAddress
  isDefaultBillingAddress
}
fragment AccountOrderDetail on Order {
  id
  number
  created
  updatedAt
  status
  chargeStatus
  shippingMethodName
  lines {
    id
    productName
    variantName
    quantity
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
  }
  subtotal {
    gross {
      amount
      currency
    }
  }
  shippingPrice {
    gross {
      amount
      currency
    }
  }
  total {
    gross {
      amount
      currency
    }
  }
  shippingAddress {
    ...AccountAddress
  }
  billingAddress {
    ...AccountAddress
  }
  fulfillments {
    id
    created
    status
    trackingNumber
    lines {
      quantity
    }
  }
}`) as unknown as TypedDocumentString<OrderByTokenQuery, OrderByTokenQueryVariables>;
export const MenuBySlugDocument = new TypedDocumentString(`
    query MenuBySlug($slug: String!) {
  menu(slug: $slug) {
    items {
      id
      name
      url
      category {
        slug
      }
      collection {
        slug
      }
      page {
        slug
      }
      children {
        id
        name
        url
        category {
          slug
        }
        collection {
          slug
        }
        page {
          slug
        }
        children {
          id
          name
          url
          category {
            slug
          }
          collection {
            slug
          }
          page {
            slug
          }
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<MenuBySlugQuery, MenuBySlugQueryVariables>;
export const PageBySlugDocument = new TypedDocumentString(`
    query PageBySlug($slug: String!) {
  page(slug: $slug) {
    title
    slug
    content
  }
}
    `) as unknown as TypedDocumentString<PageBySlugQuery, PageBySlugQueryVariables>;
export const FeaturedCollectionDocument = new TypedDocumentString(`
    query FeaturedCollection($slug: String!) {
  collection(slug: $slug) {
    name
    products(first: 8) {
      edges {
        node {
          ...ProductCard
        }
      }
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
}`) as unknown as TypedDocumentString<FeaturedCollectionQuery, FeaturedCollectionQueryVariables>;
export const HomeCategoriesDocument = new TypedDocumentString(`
    query HomeCategories {
  categories(level: 0, first: 12) {
    edges {
      node {
        name
        slug
      }
    }
  }
}
    `) as unknown as TypedDocumentString<HomeCategoriesQuery, HomeCategoriesQueryVariables>;
export const ProductSearchDocument = new TypedDocumentString(`
    query ProductSearch($q: String!, $first: Int, $after: String, $last: Int, $before: String) {
  products(search: $q, first: $first, after: $after, last: $last, before: $before) {
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
}`) as unknown as TypedDocumentString<ProductSearchQuery, ProductSearchQueryVariables>;
export const ProductDetailsDocument = new TypedDocumentString(`
    query ProductDetails($slug: String!) {
  product(slug: $slug) {
    id
    name
    slug
    description
    updatedAt
    category {
      name
      slug
      ancestors(first: 10) {
        edges {
          node {
            name
            slug
          }
        }
      }
    }
    media {
      id
      alt
      type
      thumb: url(size: 128, format: WEBP)
      medium: url(size: 1024, format: WEBP)
      large: url(size: 2048, format: WEBP)
    }
    variants {
      id
      name
      sku
      price {
        amount
        currency
      }
      quantityAvailable
      media {
        id
      }
    }
  }
}
    `) as unknown as TypedDocumentString<ProductDetailsQuery, ProductDetailsQueryVariables>;
export const ShopInfoDocument = new TypedDocumentString(`
    query ShopInfo {
  shop {
    name
  }
}
    `) as unknown as TypedDocumentString<ShopInfoQuery, ShopInfoQueryVariables>;