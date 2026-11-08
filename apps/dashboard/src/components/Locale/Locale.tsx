// Adapted from saleor-dashboard: src/components/Locale/Locale.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { ReactNode } from "react";
import { IntlProvider, ReactIntlErrorCode } from "react-intl";

// English only: every message renders its `defaultMessage`. Saleor also lazy-loads
// locale/<code>.json, remembers the choice in localStorage and exposes a LocaleContext;
// we add those only if a second language is ever needed.
const defaultLocale = "en";

export const LocaleProvider = ({ children }: { children: ReactNode }) => (
  <IntlProvider
    defaultLocale={defaultLocale}
    locale={defaultLocale}
    onError={(err) => {
      if (!(err.code === ReactIntlErrorCode.MISSING_TRANSLATION)) {
        console.error(err);
      }
    }}
  >
    {children}
  </IntlProvider>
);
