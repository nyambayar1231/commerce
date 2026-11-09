// Adapted from saleor-dashboard: src/categories/components/CategoryDetailsForm/CategoryDetailsForm.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The description is a plain-text Textarea until a rich-text editor is chosen (Saleor: EditorJS
// RichTextEditor); the background image field comes with media storage (M2.5).
import { Input, Textarea } from "@saleor/macaw-ui";
import type * as React from "react";
import { useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import FormSpacer from "../../../components/FormSpacer";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { commonMessages } from "../../../intl";
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";

interface CategoryDetailsFormProps {
  data: {
    name: string;
    description: string;
  };
  disabled: boolean;
  errors: ProductErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export const CategoryDetailsForm = ({
  disabled,
  data,
  onChange,
  errors,
}: CategoryDetailsFormProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["name", "description"], errors);

  return (
    <DetailSettingsCard
      title={intl.formatMessage(commonMessages.generalInformations)}
      data-test-id="category-general-settings"
    >
      <Input
        data-test-id="category-name-input"
        label={intl.formatMessage({
          id: "vEYtiq",
          defaultMessage: "Category Name",
        })}
        name="name"
        disabled={disabled}
        value={data.name}
        onChange={onChange}
        error={!!formErrors.name}
        helperText={getProductErrorMessage(formErrors.name, intl)}
      />
      <FormSpacer />
      <Textarea
        data-test-id="category-description-editor"
        label={intl.formatMessage({
          id: "8HRy+U",
          defaultMessage: "Category Description",
        })}
        name="description"
        disabled={disabled}
        value={data.description}
        onChange={onChange}
        rows={6}
        error={!!formErrors.description}
        helperText={getProductErrorMessage(formErrors.description, intl)}
      />
    </DetailSettingsCard>
  );
};
