import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { setPassword } from "@/lib/auth/actions";
import { AuthSkeleton } from "@/ui/components/auth/auth-skeleton";
import { LinkInvalid } from "@/ui/components/auth/link-invalid";
import { SetPasswordForm } from "@/ui/components/auth/set-password-form";

type SearchParams = Promise<{ email?: string | string[]; token?: string | string[] }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.setPassword");
  return { title: t("title"), robots: { index: false, follow: false } };
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

async function SetPasswordContent({ searchParams }: { searchParams: SearchParams }) {
  const [t, params] = await Promise.all([getTranslations("auth.setPassword"), searchParams]);
  const email = first(params.email);
  const token = first(params.token);
  if (email === "" || token === "") {
    return <LinkInvalid title={t("title")} href="/reset-password" linkLabel={t("requestNew")} />;
  }
  return <SetPasswordForm action={setPassword} email={email} token={token} />;
}

export default function SetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <SetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}
