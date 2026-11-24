// Adapted from saleor-dashboard: src/modeling/components/PageInfo/PageInfo.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's General Information card with the fields we have: title and content. The content is a
// plain-text Textarea until a rich-text editor is chosen (Saleor: EditorJS RichTextEditor), as the
// category and collection pages do; it is stored as EditorJS.
import { Input, Textarea } from "@saleor/macaw-ui";
import type * as React from "react";
import { useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import FormSpacer from "../../../components/FormSpacer";
import type { PageErrorFragment } from "../../../graphql/types.generated";
import { commonMessages } from "../../../intl";
import { getCommonFormFieldErrorMessage, getFormErrors } from "../../../utils/errors";
import { messages } from "./messages";

interface PageInfoProps {
  data: {
    title: string;
    content: string;
  };
  disabled: boolean;
  errors: PageErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export const PageInfo = ({ data, disabled, errors, onChange }: PageInfoProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["title", "content"], errors);

  return (
    <DetailSettingsCard
      title={intl.formatMessage(commonMessages.generalInformations)}
      data-test-id="page-general-settings"
    >
      <Input
        data-test-id="page-title-input"
        label={intl.formatMessage(messages.title)}
        name="title"
        disabled={disabled}
        value={data.title}
        onChange={onChange}
        error={!!formErrors.title}
        helperText={getCommonFormFieldErrorMessage(formErrors.title, intl)}
      />
      <FormSpacer />
      <Textarea
        data-test-id="page-content-editor"
        label={intl.formatMessage(messages.content)}
        name="content"
        disabled={disabled}
        value={data.content}
        onChange={onChange}
        rows={6}
        error={!!formErrors.content}
        helperText={getCommonFormFieldErrorMessage(formErrors.content, intl)}
      />
    </DetailSettingsCard>
  );
};

PageInfo.displayName = "PageInfo";
