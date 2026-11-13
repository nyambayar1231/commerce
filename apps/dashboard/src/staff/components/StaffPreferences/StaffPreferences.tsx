// Adapted from saleor-dashboard: src/staff/components/StaffPreferences/StaffPreferences.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The "Dashboard language" card (PLAN M11.2): English or Монгол. Saleor reloads the page after a
// change (a saleor-sdk cache workaround); the owner chose to keep that behaviour, so every screen
// starts fresh in the new language.
import { Box, Combobox, Text } from "@saleor/macaw-ui";
import { FormattedMessage, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import { isLocale, Locale, localeNames } from "../../../components/Locale/Locale";

interface StaffPreferencesProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

const options = Object.values(Locale).map((value) => ({ label: localeNames[value], value }));

export const StaffPreferences = ({ locale, onLocaleChange }: StaffPreferencesProps) => {
  const intl = useIntl();

  return (
    <DetailSettingsCard
      data-test-id="staff-preferences"
      title={intl.formatMessage({
        id: "AA0eYf",
        defaultMessage: "Dashboard language",
        description: "staff details sidebar card title for dashboard locale",
      })}
    >
      <Box display="flex" flexDirection="column" gap={4}>
        <Combobox
          data-test-id="staff-preferences-locale"
          label={intl.formatMessage({
            id: "cv1pnG",
            defaultMessage: "Language",
            description: "staff details locale select label",
          })}
          options={options}
          name="locale"
          value={{ label: localeNames[locale], value: locale }}
          onChange={(option) => {
            const next = option?.value;
            if (isLocale(next) && next !== locale) onLocaleChange(next);
          }}
        />
        <Text size={3} color="default2">
          <FormattedMessage
            id="I06jIl"
            defaultMessage="Note: some languages might have incomplete translations that will be displayed in English."
          />
        </Text>
      </Box>
    </DetailSettingsCard>
  );
};
