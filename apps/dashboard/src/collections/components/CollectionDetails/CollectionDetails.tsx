// Adapted from saleor-dashboard: src/collections/components/CollectionDetails/CollectionDetails.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's General Information card with the fields we have: name and description. The description
// is a plain-text Textarea until a rich-text editor is chosen (Saleor: EditorJS RichTextEditor); the
// background image field comes with media storage. The slug lives in SEO on Saleor's page, which is
// not in this step.
import { Input, Textarea } from "@saleor/macaw-ui";
import type * as React from "react";
import { useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import FormSpacer from "../../../components/FormSpacer";
import type { CollectionErrorFragment } from "../../../graphql/types.generated";
import { commonMessages } from "../../../intl";
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";
import { messages } from "./messages";

interface CollectionDetailsProps {
  data: {
    name: string;
    description: string;
  };
  disabled: boolean;
  errors: CollectionErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export const CollectionDetails = ({ disabled, data, onChange, errors }: CollectionDetailsProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["name", "description"], errors);

  return (
    <DetailSettingsCard
      title={intl.formatMessage(commonMessages.generalInformations)}
      data-test-id="collection-general-settings"
    >
      <Input
        data-test-id="collection-name-input"
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
        data-test-id="collection-description-editor"
        label={intl.formatMessage(messages.description)}
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

CollectionDetails.displayName = "CollectionDetails";
