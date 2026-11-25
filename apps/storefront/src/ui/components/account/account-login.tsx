// Adapted from saleor-storefront: src/ui/components/account/account-login.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import { usePathname } from "next/navigation";
import type { AuthAction } from "@/lib/auth/types";
import { LoginForm } from "@/ui/components/auth/login-form";

/**
 * The sign-in form shown in place of an account page for a guest. After signing in the shopper
 * lands back on the page they asked for (`next` = this path; the login action re-validates it).
 */
export function AccountLogin({ action }: { action: AuthAction }) {
  return <LoginForm action={action} next={usePathname()} />;
}
