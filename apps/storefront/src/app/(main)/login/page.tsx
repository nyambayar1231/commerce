import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { login } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/safe-redirect";
import { AuthSkeleton } from "@/ui/components/auth/auth-skeleton";
import { LoginForm } from "@/ui/components/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title"), robots: { index: false, follow: false } };
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [{ next }, current] = await Promise.all([searchParams, getCurrentUser()]);
  if (current.status === "authenticated") redirect("/");
  const target = safeNextPath(Array.isArray(next) ? next[0] : next, "");
  return <LoginForm action={login} next={target || undefined} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
