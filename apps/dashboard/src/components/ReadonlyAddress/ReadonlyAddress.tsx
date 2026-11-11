// Adapted from saleor-dashboard: src/components/ReadonlyAddress/ReadonlyAddress.tsx and
// formatAddressLines.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// An address as Saleor shows it read-only: name, company, phone, then street, city and country
// lines. Only the default size; Saleor's compact variant and legacy test ids are left out.
import { Box, Text } from "@saleor/macaw-ui";

import type { AddressFragment } from "../../graphql/types.generated";

export const getAddressDisplayName = (address: AddressFragment): string =>
  [address.firstName, address.lastName].filter(Boolean).join(" ");

export const getAddressStreetLine = (address: AddressFragment): string | null => {
  const parts = [address.streetAddress1, address.streetAddress2].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
};

export const getAddressCityLine = (address: AddressFragment): string | null => {
  const cityParts = [address.postalCode, address.city, address.cityArea].filter(Boolean);

  return cityParts.length > 0 ? cityParts.join(" ") : null;
};

export const getAddressCountryLine = (address: AddressFragment): string =>
  address.countryArea
    ? `${address.countryArea}, ${address.country.country}`
    : address.country.country;

export const ReadonlyAddress = ({ address }: { address: AddressFragment }) => {
  const displayName = getAddressDisplayName(address);
  const streetLine = getAddressStreetLine(address);
  const cityLine = getAddressCityLine(address);

  return (
    <Box as="address" display="flex" flexDirection="column" __minWidth={0} __fontStyle="inherit">
      {displayName ? (
        <Text size={4} fontWeight="medium" color="default1">
          {displayName}
        </Text>
      ) : null}
      {address.companyName ? (
        <Text size={4} color="default1">
          {address.companyName}
        </Text>
      ) : null}
      {address.phone ? (
        <Text size={4} color="default2">
          {address.phone}
        </Text>
      ) : null}
      <Box display="flex" flexDirection="column" gap={0.5}>
        {streetLine ? (
          <Text size={4} color="default1">
            {streetLine}
          </Text>
        ) : null}
        {cityLine ? (
          <Text size={4} color="default1">
            {cityLine}
          </Text>
        ) : null}
        <Text size={4} color="default1">
          {getAddressCountryLine(address)}
        </Text>
      </Box>
    </Box>
  );
};
