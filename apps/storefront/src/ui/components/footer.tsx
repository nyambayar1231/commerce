// Adapted from saleor-storefront: src/ui/components/{footer,footer-menu-columns}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import type { ReactNode } from "react";
import type { MenuItemView } from "@/lib/content/types";

const FOOTER_LINK_CLASS = "text-sm text-inverse-subtle transition-colors hover:text-inverse";

/** One footer link: `<Link>` for the shop, a new tab for an external URL. */
function FooterMenuLink({ item }: { item: MenuItemView }) {
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK_CLASS}>
        {item.name}
      </a>
    );
  }
  return (
    <Link href={item.href} prefetch={false} className={FOOTER_LINK_CLASS}>
      {item.name}
    </Link>
  );
}

/**
 * The `footer` menu's columns (Paper): each top-level item a heading, its children the links
 * under it. An empty menu renders nothing — no columns.
 */
export function FooterMenuColumns({ items }: { items: MenuItemView[] }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map((item) => (
        <div key={item.id}>
          <h4 className="mb-4 text-sm font-medium text-inverse">{item.name}</h4>
          <ul className="space-y-3">
            {item.children.map((child) => (
              <li key={child.id}>
                <FooterMenuLink item={child} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/**
 * Footer frame: shop name and copyright, plus fixed-size slots filled by the app layer (they
 * read data). `menu` holds the footer menu's columns; the brand column and the menu columns
 * share Paper's grid.
 */
export function Footer({
  shopName,
  menu,
  copyright,
}: {
  shopName: ReactNode;
  menu: ReactNode;
  copyright: ReactNode;
}) {
  return (
    <footer className="bg-foreground text-background">
      <div className="container-content pb-24 pt-12 sm:pb-12 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-4 inline-block text-xl font-semibold">
              {shopName}
            </Link>
          </div>
          {menu}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-inverse pt-8 sm:flex-row">
          <p className="text-xs text-inverse-muted">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
