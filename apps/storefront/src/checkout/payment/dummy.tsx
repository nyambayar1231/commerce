// Adapted from saleor-storefront: src/checkout/components/payment/dummy-payment-placeholder.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * The dummy gateway's payment UI: no card fields, the gateway is chosen on the server when the
 * shopper places the order. The notice says plainly that no money is taken (ARCHITECTURE §10.9).
 */
export function DummyPayment() {
  const t = useTranslations("checkout.payment");
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="text-foreground">{t("providers.dummy")}</span>
          {" · "}
          {t("testNotice")}
        </span>
      </p>
    </div>
  );
}
