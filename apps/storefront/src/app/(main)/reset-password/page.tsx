import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requestPasswordReset } from "@/lib/auth/actions";
import { ResetPasswordForm } from "@/ui/components/auth/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm action={requestPasswordReset} />;
}
