import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations();

  return (
    <div className="container-content py-section-sm">
      <h1 className="text-h1 text-foreground">
        {t("home.title", { shopName: t("common.shopName") })}
      </h1>
      <p className="mt-4 text-lead text-muted-foreground">{t("home.intro")}</p>
    </div>
  );
}
