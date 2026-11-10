// Adapted from saleor-dashboard: src/products/components/ProductDetailsForm/ProductDetailsForm.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// General information: the name and the description. The description is a plain-text Textarea
// until a rich-text editor is chosen (Saleor: EditorJS RichTextEditor); rating, shipping weight,
// media and SEO come later. Description errors are reported as notifications (see form.tsx).
import { Input, Textarea } from "@saleor/macaw-ui";
import type * as React from "react";
import { defineMessages, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import FormSpacer from "../../../components/FormSpacer";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { commonMessages } from "../../../intl";
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";

const messages = defineMessages({
  name: {
    id: "6AMFki",
    defaultMessage: "Name",
    description: "product name",
  },
  description: {
    id: "Q8Qw5B",
    defaultMessage: "Description",
  },
});

interface ProductDetailsFormProps {
  data: {
    name: string;
    description: string;
  };
  disabled: boolean;
  errors: ProductErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export const ProductDetailsForm = ({
  disabled,
  data,
  onChange,
  errors,
}: ProductDetailsFormProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["name"], errors);

  return (
    <DetailSettingsCard
      title={intl.formatMessage(commonMessages.generalInformations)}
      data-test-id="product-general-settings"
    >
      <Input
        data-test-id="product-name-input"
        label={intl.formatMessage(messages.name)}
        name="name"
        disabled={disabled}
        value={data.name}
        onChange={onChange}
        error={!!formErrors.name}
        helperText={getProductErrorMessage(formErrors.name, intl)}
      />
      <FormSpacer />
      <Textarea
        data-test-id="product-description-editor"
        label={intl.formatMessage(messages.description)}
        name="description"
        disabled={disabled}
        value={data.description}
        onChange={onChange}
        rows={6}
      />
    </DetailSettingsCard>
  );
};
