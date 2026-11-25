"use client";

// Adapted from saleor-storefront: src/ui/components/nav/components/{nav-links-desktop,mega-menu-desktop,mega-menu-link}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { MenuItemView } from "@/lib/content/types";
import { cn } from "@/lib/utils";

// Paper's mega menu rebuilt on the user-menu disclosure pattern (no Radix): a top item with
// children is a button whose panel drops from the header, closed by Escape (focus returns to
// the trigger), a pointerdown outside, or a navigation. Tab reaches the panel from the trigger,
// since the panel follows it in the DOM.

const TOP_LEVEL_CLASS =
  "inline-flex items-baseline h-auto rounded-none border-b-2 border-transparent bg-transparent px-0 py-1 text-sm font-medium text-muted-foreground no-underline hover:bg-transparent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const COLUMN_HEADER_CLASS =
  "mb-0 block text-sm font-semibold tracking-tight text-foreground no-underline transition-colors hover:text-foreground/80";

const LEAF_LINK_CLASS =
  "block text-sm text-muted-foreground no-underline transition-colors hover:text-foreground";

function active(pathname: string, item: MenuItemView): boolean {
  return !item.external && pathname === item.href;
}

/** One link of the tree: `<Link>` for the shop, a new tab for an external URL. */
function MenuLink({
  item,
  onClose,
  className,
  children,
}: {
  item: MenuItemView;
  onClose?: () => void;
  className: string;
  children?: ReactNode;
}) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClose}
      >
        {children ?? item.name}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} onClick={onClose}>
      {children ?? item.name}
    </Link>
  );
}

/** A top-level item without children: one link. */
function TopLevelLink({ item }: { item: MenuItemView }) {
  const pathname = usePathname();
  return (
    <MenuLink
      item={item}
      className={cn(TOP_LEVEL_CLASS, active(pathname, item) && "border-foreground text-foreground")}
    />
  );
}

/** One column of the dropdown: the child as its heading, its children as leaf links. */
function MegaMenuColumn({ item, onClose }: { item: MenuItemView; onClose: () => void }) {
  return (
    <div className="min-w-0 flex-1">
      <MenuLink item={item} onClose={onClose} className={COLUMN_HEADER_CLASS} />
      {item.children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {item.children.map((child) => (
            <li key={child.id}>
              <MenuLink item={child} onClose={onClose} className={LEAF_LINK_CLASS} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A top-level item with children: the disclosure button and its full-width dropdown panel. */
function TopLevelDropdown({ item }: { item: MenuItemView }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLLIElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

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

  const close = () => setOpen(false);
  const panelId = `nav-panel-${item.id}`;

  return (
    // No `relative` on the list item: the panel's containing block is the `<header>`, so it
    // spans the header's width (Paper's mega menu panel) instead of the button's.
    <li ref={root}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          TOP_LEVEL_CLASS,
          "gap-0.5",
          active(pathname, item) && "border-foreground text-foreground",
          open && "border-foreground text-foreground",
        )}
      >
        {item.name}
        <ChevronDown
          className={cn(
            "relative top-0 ml-0.5 h-3 w-3 shrink-0 self-center text-muted-foreground transition-transform duration-200",
            open && "rotate-180 text-foreground",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full z-50 border-b border-border bg-background shadow-md"
        >
          <div className="container-nav py-6">
            <div className="flex items-start gap-x-8 lg:gap-x-10">
              {item.children.map((child) => (
                <MegaMenuColumn key={child.id} item={child} onClose={close} />
              ))}
            </div>
            <div className="mt-6 border-t border-border pt-5">
              <MenuLink
                item={item}
                onClose={close}
                className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
              >
                {t("viewAll", { label: item.name })}
              </MenuLink>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** The desktop nav: every top-level item, the parent items as dropdown triggers (below `lg` the header hides this and shows the mobile menu button instead). */
export function NavLinksDesktop({ items }: { items: MenuItemView[] }) {
  return (
    <ul className="flex items-baseline gap-6">
      {items.map((item) =>
        item.children.length > 0 ? (
          <TopLevelDropdown key={item.id} item={item} />
        ) : (
          <li key={item.id}>
            <TopLevelLink item={item} />
          </li>
        ),
      )}
    </ul>
  );
}
