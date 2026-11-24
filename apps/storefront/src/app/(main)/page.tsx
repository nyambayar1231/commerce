import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getShop } from "@/lib/content/shop";

async function HomeTitle() {
  const [t, shop] = await Promise.all([getTranslations("home"), getShop()]);
  return t("title", { shopName: shop.name });
}

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <div className="container-content py-section-sm">
      <h1 className="text-h1 text-foreground">
        <Suspense fallback={<span aria-hidden="true" className="inline-block h-[1em] w-64" />}>
          <HomeTitle />
        </Suspense>
      </h1>
      <p className="mt-4 text-lead text-muted-foreground">{t("intro")}</p>
    </div>
  );
}
