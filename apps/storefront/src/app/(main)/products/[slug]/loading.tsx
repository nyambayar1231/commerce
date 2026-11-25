import { getTranslations } from "next-intl/server";
import { ProductRouteSkeleton } from "@/ui/components/pdp/product-route-skeleton";

// The route's loading state, sized like the live page (Paper's route skeleton): shown
// immediately on client navigations to another product.

export default async function Loading() {
  const t = await getTranslations("pdp");
  return <ProductRouteSkeleton surface="route" label={t("loading")} />;
}
