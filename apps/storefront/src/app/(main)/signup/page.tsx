import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { register } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AuthSkeleton } from "@/ui/components/auth/auth-skeleton";
import { SignUpForm } from "@/ui/components/auth/sign-up-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("title"), robots: { index: false, follow: false } };
}

async function SignUpContent() {
  if ((await getCurrentUser()).status === "authenticated") redirect("/");
  return <SignUpForm action={register} />;
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <SignUpContent />
    </Suspense>
  );
}
