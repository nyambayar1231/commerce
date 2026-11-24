import { getRequestConfig } from "next-intl/server";
import messages from "../../messages/mn.json";
import { LOCALE, TIME_ZONE } from "./config";

// next-intl without i18n routing: one locale, read by every server and client component.
export default getRequestConfig(async () => ({ locale: LOCALE, timeZone: TIME_ZONE, messages }));
