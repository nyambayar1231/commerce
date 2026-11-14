// Mongolian dates in browsers without Mongolian date data (PLAN M11.6). Chrome ships none for `mn`
// (`Intl.DateTimeFormat.supportedLocalesOf(["mn"])` is empty) and formats in en-US instead; Safari
// and Firefox have it. Where it is missing, FormatJS's Intl.DateTimeFormat polyfill replaces the
// browser's, with the `mn` locale data and the "golden" time zone set (Asia/Ulaanbaatar and the
// other common zones). Everything is loaded lazily, only then, so other browsers and English
// download nothing. Numbers need no polyfill: mn and en-US write them the same (140,000).
import { shouldPolyfill } from "@formatjs/intl-datetimeformat/should-polyfill.js";

const localeData: Record<"mn", () => Promise<unknown>> = {
  mn: () => import("@formatjs/intl-datetimeformat/locale-data/mn.js"),
};

export async function polyfillDateTimeFormat(locale: "mn"): Promise<void> {
  if (!shouldPolyfill(locale)) return;

  // The polyfill's default time zone is UTC; keep the browser's, read before it is replaced.
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  // The locale and time zone data register on the polyfilled Intl.DateTimeFormat, so it loads first.
  await import("@formatjs/intl-datetimeformat/polyfill-force.js");
  await Promise.all([
    localeData[locale](),
    import("@formatjs/intl-datetimeformat/add-golden-tz.js"),
  ]);
  const polyfilled = Intl.DateTimeFormat as typeof Intl.DateTimeFormat & {
    __setDefaultTimeZone?: (timeZone: string) => void;
  };
  try {
    polyfilled.__setDefaultTimeZone?.(timeZone);
  } catch {
    // A zone outside the golden set: the polyfill keeps UTC, and dates still read in Mongolian.
  }
}
