import "@/styles/brand.css";
import "@/app/globals.css";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LOCALE } from "@/i18n/config";
import { getRootHtmlFontProps } from "@/lib/fonts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("shopName") };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html {...getRootHtmlFontProps(LOCALE)}>
      <body className="min-h-dvh font-sans">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
