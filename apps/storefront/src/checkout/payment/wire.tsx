import { QrCode } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * QPay through Wire (ADR-0016): nothing to fill in here. Placing the order opens Wire's secure
 * page, where the shopper scans the QR code or pays in their bank app, then comes back.
 */
export function WirePayment() {
  const t = useTranslations("checkout.payment");
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <QrCode className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="text-foreground">{t("providers.wire")}</span>
        {" · "}
        {t("wireNotice")}
      </span>
    </p>
  );
}
