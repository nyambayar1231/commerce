// Adapted from saleor-dashboard: src/structures/components/MenuProperties/MenuProperties.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The menu's General Information card: the name only (our API has no slug input on this screen, as
// the brief).
import { Input } from "@saleor/macaw-ui";
import type * as React from "react";
import { useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import type { MenuErrorFragment } from "../../../graphql/types.generated";
import { commonMessages } from "../../../intl";
import { getCommonFormFieldErrorMessage, getFormErrors } from "../../../utils/errors";
import type { MenuDetailsFormData } from "../MenuDetailsPage/MenuDetailsPage";

interface MenuPropertiesProps {
  data: MenuDetailsFormData;
  disabled: boolean;
  errors: MenuErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const MenuProperties = ({ data, disabled, errors, onChange }: MenuPropertiesProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["name"], errors);

  return (
    <DetailSettingsCard
      title={intl.formatMessage(commonMessages.generalInformations)}
      data-test-id="menu-general-settings"
    >
      <Input
        data-test-id="menu-name"
        disabled={disabled}
        error={!!formErrors.name}
        aria-invalid={!!formErrors.name}
        name="name"
        label={intl.formatMessage({
          id: "qL9Oi9",
          defaultMessage: "Structure Title",
        })}
        helperText={getCommonFormFieldErrorMessage(formErrors.name, intl)}
        value={data.name}
        onChange={onChange}
      />
    </DetailSettingsCard>
  );
};

MenuProperties.displayName = "MenuProperties";
