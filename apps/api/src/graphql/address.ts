import { type Address, COUNTRY_CODES, type CountryCode, countryName } from "@commerce/contracts";
import { builder } from "./builder.ts";
import { toGlobalId } from "./globalId.ts";

// Saleor's address GraphQL types, shared by checkout, orders and the customer address book (the
// address snapshot is the same shape everywhere). The domain rules live in @commerce/contracts
// (address.ts, countries.ts).

export const CountryCodeEnum = builder.enumType("CountryCode", { values: COUNTRY_CODES });

export const CountryDisplay = builder.objectRef<CountryCode>("CountryDisplay").implement({
  description: "Represents country.",
  fields: (t) => ({
    code: t.string({ description: "Country code.", resolve: (code) => code }),
    country: t.string({ description: "Country name.", resolve: (code) => countryName(code) }),
  }),
});

// A checkout's or order's address is a JSON snapshot with no row behind it (ARCHITECTURE §3), so
// these three are optional: an address book entry fills them, a snapshot leaves them null.
export type AddressValue = Address & {
  id?: string | null;
  isDefaultShippingAddress?: boolean | null;
  isDefaultBillingAddress?: boolean | null;
};

export const AddressType = builder.objectRef<AddressValue>("Address").implement({
  description: "Represents user address data.",
  fields: (t) => ({
    id: t.id({
      nullable: true,
      description: "The ID of the address.",
      resolve: (address) => (address.id ? toGlobalId("Address", address.id) : null),
    }),
    firstName: t.exposeString("firstName", { description: "The given name of the address." }),
    lastName: t.exposeString("lastName", { description: "The family name of the address." }),
    companyName: t.exposeString("companyName", { description: "Company or organization name." }),
    streetAddress1: t.exposeString("streetAddress1", {
      description: "The first line of the address.",
    }),
    streetAddress2: t.exposeString("streetAddress2", {
      description: "The second line of the address.",
    }),
    city: t.exposeString("city", { description: "The city of the address." }),
    cityArea: t.exposeString("cityArea", { description: "The district of the address." }),
    postalCode: t.exposeString("postalCode", { description: "The postal code of the address." }),
    country: t.field({
      type: CountryDisplay,
      description: "The country of the address.",
      resolve: (address) => address.country,
    }),
    countryArea: t.exposeString("countryArea", {
      description: "The country area of the address.",
    }),
    phone: t.string({
      nullable: true,
      description: "The phone number assigned the address.",
      resolve: (address) => address.phone || null,
    }),
    isDefaultShippingAddress: t.boolean({
      nullable: true,
      description: "Address is user's default shipping address.",
      resolve: (address) => address.isDefaultShippingAddress ?? null,
    }),
    isDefaultBillingAddress: t.boolean({
      nullable: true,
      description: "Address is user's default billing address.",
      resolve: (address) => address.isDefaultBillingAddress ?? null,
    }),
  }),
});

export const AddressInput = builder.inputType("AddressInput", {
  fields: (t) => ({
    firstName: t.string({ description: "Given name." }),
    lastName: t.string({ description: "Family name." }),
    companyName: t.string({ description: "Company or organization." }),
    streetAddress1: t.string({ description: "Address." }),
    streetAddress2: t.string({ description: "Address." }),
    city: t.string({ description: "City." }),
    cityArea: t.string({ description: "District." }),
    postalCode: t.string({ description: "Postal code." }),
    country: t.field({ type: CountryCodeEnum, description: "Country." }),
    countryArea: t.string({ description: "State or province." }),
    phone: t.string({ description: "Phone number." }),
  }),
});
