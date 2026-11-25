"use client";

// Adapted from saleor-storefront: src/ui/components/nav/components/{mobile-menu,mobile-nav-links}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Menu as MenuIcon, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { MenuItemView } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { SearchBar } from "./search-bar";

// Paper's mobile sheet rebuilt on a native `<dialog>` (no dialog library): `showModal()` traps
// focus inside and Escape closes it; the `close` event returns focus to the trigger. The menu
// tree is nested lists, and the search form submits out of the dialog (a GET form, so it also
// works without JavaScript).

/** One link of the tree: `<Link>` for the shop, a new tab for an external URL. */
function MobileNavLink({
  item,
  onClose,
  className,
}: {
  item: MenuItemView;
  onClose: () => void;
  className: string;
}) {
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        {item.name}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} onClick={onClose}>
      {item.name}
    </Link>
  );
}

/** A middle item with children: its own link, then its children as a nested list. */
function MobileNavSection({ item, onClose }: { item: MenuItemView; onClose: () => void }) {
  return (
    <li>
      <MobileNavLink
        item={item}
        onClose={onClose}
        className="block text-sm font-semibold tracking-tight text-foreground/90 transition-colors hover:text-foreground"
      />
      <ul className="ml-1 mt-1 space-y-0.5 border-l-2 border-border pl-3">
        {item.children.map((grandchild) => (
          <li key={grandchild.id}>
            <MobileNavLink
              item={grandchild}
              onClose={onClose}
              className="block rounded-md py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            />
          </li>
        ))}
      </ul>
    </li>
  );
}

/** A top-level item with children: the item's link, its children indented under it. */
function MobileNavGroup({ item, onClose }: { item: MenuItemView; onClose: () => void }) {
  return (
    <li>
      <MobileNavLink
        item={item}
        onClose={onClose}
        className="block text-base font-semibold tracking-tight text-foreground transition-colors hover:underline"
      />
      <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
        {item.children.map((child) =>
          child.children.length > 0 ? (
            <MobileNavSection key={child.id} item={child} onClose={onClose} />
          ) : (
            <li key={child.id}>
              <MobileNavLink
                item={child}
                onClose={onClose}
                className="block rounded-md py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              />
            </li>
          ),
        )}
      </ul>
    </li>
  );
}

/** The whole tree as nested lists: childless items as links, parents as indented groups. */
function MobileNavList({ items, onClose }: { items: MenuItemView[]; onClose: () => void }) {
  return (
    <ul className="flex flex-col whitespace-nowrap p-4 [&>*:nth-child(n+2)]:border-t [&>*:nth-child(n+2)]:border-border [&>li]:py-3">
      {items.map((item) =>
        item.children.length > 0 ? (
          <MobileNavGroup key={item.id} item={item} onClose={onClose} />
        ) : (
          <li key={item.id}>
            <MobileNavLink
              item={item}
              onClose={onClose}
              className="block text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
            />
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * The mobile menu: a hamburger button (below `lg`) opening a native `<dialog>` with the same
 * nav tree plus the search form. The dialog element keeps no React state — `showModal()` and
 * `close()` drive it, so nothing can desync.
 */
export function MobileMenu({ items }: { items: MenuItemView[] }) {
  const t = useTranslations("nav");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const returnFocus = () => trigger.current?.focus();
    element.addEventListener("close", returnFocus);
    return () => element.removeEventListener("close", returnFocus);
  }, []);

  const close = () => dialog.current?.close();

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-accent lg:hidden"
        aria-label={t("mobileOpen")}
        onClick={() => dialog.current?.showModal()}
      >
        <MenuIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        aria-label={t("mobileTitle")}
        className={cn(
          "m-0 h-dvh w-full max-w-sm border-none bg-background p-0",
          "backdrop:bg-foreground/50",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-base font-semibold text-foreground">{t("mobileTitle")}</p>
            <button
              type="button"
              onClick={close}
              aria-label={t("mobileClose")}
              className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-accent"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {/* The submit event bubbles, so closing here keeps the dialog from staying open over
              the client-side navigation a GET form becomes when JavaScript is available. */}
          <div className="border-b border-border p-4" onSubmit={close}>
            <SearchBar id="mobile-search" />
          </div>
          <nav className="flex-1 overflow-y-auto" aria-label={t("mobileTitle")}>
            <MobileNavList items={items} onClose={close} />
          </nav>
        </div>
      </dialog>
    </>
  );
}
