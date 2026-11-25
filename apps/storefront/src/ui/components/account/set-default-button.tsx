"use client";

// Adapted from saleor-storefront: src/ui/components/account/address-actions.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { SimpleAction, SimpleActionState } from "@/lib/account/types";

const idle: SimpleActionState = { status: "idle" };

/** "Make default shipping/billing": a form per address and type, posting the Server Action. */
export function SetDefaultButton({
  addressId,
  type,
  action,
}: {
  addressId: string;
  type: "SHIPPING" | "BILLING";
  action: SimpleAction;
}) {
  const t = useTranslations("address.book");
  const te = useTranslations("errors");
  const [state, formAction, pending] = useActionState(action, idle);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={addressId} />
      <input type="hidden" name="type" value={type} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? t("settingDefault")
          : type === "SHIPPING"
            ? t("makeDefaultShipping")
            : t("makeDefaultBilling")}
      </button>
      <span aria-live="polite" className="ml-2 text-xs text-destructive">
        {state.status === "error" && state.message ? te(state.message) : null}
      </span>
    </form>
  );
}
