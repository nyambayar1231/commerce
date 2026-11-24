"use client";

// Adapted from saleor-storefront: src/ui/components/nav/components/user-menu/{user-menu,components/user-avatar,components/user-info}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { CustomerSummary } from "@/lib/auth/types";

const itemClassName =
  "block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-hidden";

function initials(user: CustomerSummary): string {
  return user.firstName && user.lastName
    ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`
    : user.email.slice(0, 2);
}

/**
 * Signed-in menu: a disclosure (button + panel), closed by Escape or a click outside; Escape
 * returns focus to the trigger. `logoutAction` is the Server Action, passed in by the page.
 */
export function UserMenu({
  user,
  logoutAction,
}: {
  user: CustomerSummary;
  logoutAction: () => Promise<void>;
}) {
  const t = useTranslations("userMenu");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="user-menu-panel"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="sr-only">{t("open")}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-center text-xs font-bold uppercase text-foreground"
          aria-hidden="true"
        >
          {initials(user)}
        </span>
      </button>
      {open ? (
        <div
          id="user-menu-panel"
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">
            {name ? (
              <span className="mb-0.5 block truncate font-medium text-foreground">{name}</span>
            ) : null}
            <span className="block truncate">{user.email}</span>
          </div>
          <hr className="-mx-1 my-1 border-border" />
          <Link href="/account" className={itemClassName} onClick={() => setOpen(false)}>
            {t("myAccount")}
          </Link>
          <Link href="/account/orders" className={itemClassName} onClick={() => setOpen(false)}>
            {t("myOrders")}
          </Link>
          <hr className="-mx-1 my-1 border-border" />
          <form action={logoutAction}>
            <button type="submit" className={itemClassName}>
              {t("signOut")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
