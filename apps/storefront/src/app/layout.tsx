import "@/styles/brand.css";
import "@/app/globals.css";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { LOCALE } from "@/i18n/config";
import { getShop } from "@/lib/content/shop";
import { getRootHtmlFontProps } from "@/lib/fonts";

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop();
  return { title: { template: `%s | ${shop.name}`, default: shop.name } };
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
