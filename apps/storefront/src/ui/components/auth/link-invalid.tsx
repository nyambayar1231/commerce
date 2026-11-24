import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthCard, linkClassName } from "./auth-form-parts";

/** Shown by /set-password and /confirm-account when the link has no email or token. */
export function LinkInvalid({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  const t = useTranslations("errors");
  return (
    <AuthCard title={title}>
      <p role="alert" className="text-center text-muted-foreground">
        {t("linkInvalid")}
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href={href} className={linkClassName}>
          {linkLabel}
        </Link>
      </p>
    </AuthCard>
  );
}
