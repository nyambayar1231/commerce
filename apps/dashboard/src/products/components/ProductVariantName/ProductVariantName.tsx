// Adapted from saleor-dashboard: src/products/components/ProductVariantName/ProductVariantName.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's "Variant Name" card with the variant's name input.
// Attributes, media, SEO and metadata are not on the page yet.
import { Input } from "@saleor/macaw-ui";
import type * as React from "react";
import { defineMessages, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";

const messages = defineMessages({
  title: {
    id: "T1f2Yl",
    defaultMessage: "Variant Name",
  },
  name: {
    id: "6AMFki",
    defaultMessage: "Name",
    description: "product name",
  },
});

interface ProductVariantNameProps {
  value: string;
  disabled: boolean;
  errors: ProductErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProductVariantName = ({
  value,
  disabled,
  errors,
  onChange,
}: ProductVariantNameProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["name"], errors);

  return (
    <DetailSettingsCard title={intl.formatMessage(messages.title)} data-test-id="variant-name">
      <Input
        data-test-id="variant-name-input"
        label={intl.formatMessage(messages.name)}
        name="name"
        disabled={disabled}
        value={value}
        onChange={onChange}
        error={!!formErrors.name}
        helperText={getProductErrorMessage(formErrors.name, intl)}
      />
    </DetailSettingsCard>
  );
};

ProductVariantName.displayName = "ProductVariantName";
