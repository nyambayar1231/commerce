// Adapted from saleor-dashboard: src/components/Locale/Locale.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The dashboard language (PLAN M11): Mongolian or English, Mongolian by default, remembered in
// localStorage under Saleor's key `locale`. Messages are react-intl's; a non-English locale's
// translations load lazily from locale/<code>.json (Saleor's format, see `LocaleMessages`), and a
// message without a translation falls back to its English `defaultMessage`.
// Unlike Saleor, nothing renders until that file is loaded, so a Mongolian page never flashes
// English first. Saleor's 42 locales are cut to the two we ship.
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { IntlProvider, ReactIntlErrorCode } from "react-intl";
import useLocalStorage from "../../hooks/useLocalStorage";

export const Locale = {
  EN: "en",
  MN: "mn",
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

/** Each language named in itself, as the language picker shows it. */
export const localeNames: Record<Locale, string> = {
  [Locale.EN]: "English",
  [Locale.MN]: "Монгол",
};

export const defaultLocale: Locale = Locale.MN;

/** A locale file: message id → the translation and the extractor's description. */
export type LocaleMessages = Record<string, { context?: string; string: string }>;

const localeFiles: Record<Exclude<Locale, "en">, () => Promise<{ default: LocaleMessages }>> = {
  [Locale.MN]: () => import("../../../locale/mn.json"),
};

export function isLocale(value: unknown): value is Locale {
  return Object.values(Locale).includes(value as Locale);
}

/** Saleor's getKeyValueJson: the file's entries as react-intl's id → message map. */
export function toIntlMessages(messages: LocaleMessages): Record<string, string> {
  return Object.fromEntries(Object.entries(messages).map(([id, message]) => [id, message.string]));
}

// English needs no translations. One shared object, so setting it again doesn't re-render.
const NO_MESSAGES: Record<string, string> = {};

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextType>({
  locale: defaultLocale,
  setLocale: () => undefined,
});

export const useLocale = () => useContext(LocaleContext);

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [stored, setLocale] = useLocalStorage<string>("locale", defaultLocale);
  // An unknown stored value (an old or hand-edited one) means the default.
  const locale = isLocale(stored) ? stored : defaultLocale;
  // undefined while a locale file loads; English needs none.
  const [messages, setMessages] = useState<Record<string, string> | undefined>(
    locale === Locale.EN ? NO_MESSAGES : undefined,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    if (locale === Locale.EN) {
      setMessages(NO_MESSAGES);
      return;
    }
    let current = true;
    setMessages(undefined);
    localeFiles[locale]()
      .then((file) => {
        if (current) setMessages(toIntlMessages(file.default));
      })
      .catch((error: unknown) => {
        // Without the file the dashboard is still usable in English.
        console.error(`Could not load the ${locale} translations`, error);
        if (current) setMessages(NO_MESSAGES);
      });
    return () => {
      current = false;
    };
  }, [locale]);

  if (messages === undefined) return null;

  return (
    <IntlProvider
      defaultLocale={Locale.EN}
      locale={locale}
      messages={messages}
      onError={(err) => {
        if (err.code !== ReactIntlErrorCode.MISSING_TRANSLATION) {
          console.error(err);
        }
      }}
      key={locale}
    >
      <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
    </IntlProvider>
  );
};
