import { type Address, COUNTRY_CODES, type CountryCode, countryName } from "@commerce/contracts";
import { builder } from "./builder.ts";

// Saleor's address GraphQL types, shared by checkout and orders (the address snapshot is the same
// shape everywhere). The domain rules live in @commerce/contracts (address.ts, countries.ts).

export const CountryCodeEnum = builder.enumType("CountryCode", { values: COUNTRY_CODES });

export const CountryDisplay = builder.objectRef<CountryCode>("CountryDisplay").implement({
  description: "Represents country.",
  fields: (t) => ({
    code: t.string({ description: "Country code.", resolve: (code) => code }),
    country: t.string({ description: "Country name.", resolve: (code) => countryName(code) }),
  }),
});

// Saleor's Address without `id`, metadata and the default-address flags: a checkout's address is a
// JSON snapshot, not a row (ARCHITECTURE §3), so there is nothing for an id to point at.
export const AddressType = builder.objectRef<Address>("Address").implement({
  description: "Represents user address data.",
  fields: (t) => ({
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
