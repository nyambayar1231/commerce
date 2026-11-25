import "@/styles/brand.css";
import "@/app/globals.css";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { LOCALE } from "@/i18n/config";
import { getShop } from "@/lib/content/shop";
import { getEnv } from "@/lib/env";
import { getRootHtmlFontProps } from "@/lib/fonts";
import { defaultOpenGraph } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop();
  return {
    metadataBase: new URL(getEnv().storefrontUrl),
    title: { template: `%s | ${shop.name}`, default: shop.name },
    openGraph: defaultOpenGraph(shop.name),
  };
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
