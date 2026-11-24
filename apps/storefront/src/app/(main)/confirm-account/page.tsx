import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { confirmAccount } from "@/lib/auth/actions";
import { AuthSkeleton } from "@/ui/components/auth/auth-skeleton";
import { ConfirmAccountForm } from "@/ui/components/auth/confirm-account-form";
import { LinkInvalid } from "@/ui/components/auth/link-invalid";

type SearchParams = Promise<{ email?: string | string[]; token?: string | string[] }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.confirm");
  return { title: t("title"), robots: { index: false, follow: false } };
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

async function ConfirmAccountContent({ searchParams }: { searchParams: SearchParams }) {
  const [t, params] = await Promise.all([getTranslations("auth.confirm"), searchParams]);
  const email = first(params.email);
  const token = first(params.token);
  if (email === "" || token === "") {
    return <LinkInvalid title={t("title")} href="/signup" linkLabel={t("goToSignIn")} />;
  }
  return <ConfirmAccountForm action={confirmAccount} email={email} token={token} />;
}

export default function ConfirmAccountPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <ConfirmAccountContent searchParams={searchParams} />
    </Suspense>
  );
}
