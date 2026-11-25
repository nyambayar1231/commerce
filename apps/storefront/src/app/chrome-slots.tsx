// CopyrightSlot adapted from saleor-storefront: src/ui/components/copyright-text.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { removeLine, updateLine } from "@/lib/cart/actions";
import { getCart } from "@/lib/cart/cart";
import { isCartUnavailable } from "@/lib/cart/types";
import { getMenu } from "@/lib/content/menus";
import { getShop } from "@/lib/content/shop";
import type { MenuItemView } from "@/lib/content/types";
import { CartButton } from "@/ui/components/cart/cart-button";
import { CartDrawer } from "@/ui/components/cart/cart-drawer";
import { CartDrawerContents } from "@/ui/components/cart/cart-drawer-contents";
import { FooterMenuColumns } from "@/ui/components/footer";
import { MobileMenu } from "@/ui/components/nav/mobile-menu";
import { NavLinksDesktop } from "@/ui/components/nav/nav-links-desktop";
import { UserMenu } from "@/ui/components/nav/user-menu/user-menu";
import { UserMenuLoginLink } from "@/ui/components/nav/user-menu/user-menu-login-link";
import { UserMenuUnavailable } from "@/ui/components/nav/user-menu/user-menu-unavailable";

// The chrome's data islands. They live in src/app because they call loaders; the frames in
// src/ui receive them as slots (ARCHITECTURE §10.3). Each one reads runtime data, so it is always
// rendered inside `<Suspense>` with a fallback of the same size.

/**
 * The navbar menu's items with Paper's "All products" link first. The navbar menu is empty
 * for now, so this is the one fallback link "Бүх бүтээгдэхүүн" → `/products`; once the owner
 * fills the menu it stays as the first link (Paper's first nav entry).
 */
async function navbarItems(): Promise<MenuItemView[]> {
  const [items, t] = await Promise.all([getMenu("navbar"), getTranslations("nav")]);
  return [
    {
      id: "all-products",
      name: t("allProducts"),
      href: "/products",
      external: false,
      children: [],
    },
    ...items,
  ];
}

/** The shop's name from the API (cached). */
export async function ShopNameSlot() {
  const shop = await getShop();
  return shop.name;
}

/** Skeleton for `ShopNameSlot`: reserves the line's height and about one name's width. */
export function ShopNameSkeleton() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[1em] w-32 animate-pulse rounded bg-muted align-middle"
    />
  );
}

/** The desktop nav: the navbar menu's links and dropdowns (cached). */
export async function NavSlot() {
  return <NavLinksDesktop items={await navbarItems()} />;
}

/** Skeleton for `NavSlot`: a row of link-sized pulses inside the desktop nav's width. */
export function NavSlotSkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-6">
      <span className="h-4 w-16 animate-pulse rounded bg-muted" />
      <span className="h-4 w-12 animate-pulse rounded bg-muted" />
      <span className="h-4 w-8 animate-pulse rounded bg-muted" />
    </div>
  );
}

/** The mobile menu button and its dialog: the same tree, plus the search form (cached). */
export async function MobileMenuSlot() {
  return <MobileMenu items={await navbarItems()} />;
}

/** Skeleton for `MobileMenuSlot`: the menu button's square, hidden at `lg` like the button. */
export function MobileMenuSlotSkeleton() {
  return (
    <div aria-hidden="true" className="h-10 w-10 animate-pulse rounded-md bg-muted lg:hidden" />
  );
}

/** The footer menu's columns (cached); no columns when the `footer` menu is empty. */
export async function FooterMenuSlot() {
  const items = await getMenu("footer");
  return <FooterMenuColumns items={items} />;
}

/** Skeleton for `FooterMenuSlot`: three column-shaped pulses beside the brand column. */
export function FooterMenuSkeleton() {
  return (
    <>
      {[0, 1, 2].map((column) => (
        <div key={column} aria-hidden="true">
          <div className="mb-4 h-4 w-20 animate-pulse rounded bg-inverse-muted/40" />
          <div className="h-4 w-24 animate-pulse rounded bg-inverse-muted/40" />
          <div className="mt-3 h-4 w-16 animate-pulse rounded bg-inverse-muted/40" />
        </div>
      ))}
    </>
  );
}

/** Sign-in link, the customer's menu, or the "unavailable" icon, from the session cookie. */
export async function UserMenuSlot() {
  const current = await getCurrentUser();
  if (current.status === "authenticated") {
    return <UserMenu user={current.user} logoutAction={logout} />;
  }
  return current.status === "unavailable" ? <UserMenuUnavailable /> : <UserMenuLoginLink />;
}

/** Skeleton for `UserMenuSlot`: the size of the sign-in link. */
export function UserMenuSkeleton() {
  return <div aria-hidden="true" className="h-10 w-24 animate-pulse rounded-md bg-muted" />;
}

/** The header's cart button with the item count, from the checkout cookie. */
export async function CartButtonSlot() {
  const cart = await getCart();
  return <CartButton count={cart === null || isCartUnavailable(cart) ? 0 : cart.quantity} />;
}

/** The cart drawer: a client shell around contents rendered here from the cart. */
export async function CartDrawerSlot() {
  const cart = await getCart();
  const itemCount = cart === null || isCartUnavailable(cart) ? 0 : cart.quantity;
  return (
    <CartDrawer itemCount={itemCount}>
      <CartDrawerContents cart={cart} updateLine={updateLine} removeLine={removeLine} />
    </CartDrawer>
  );
}

/**
 * Copyright line with the current year. `new Date()` during a prerender is sync IO and breaks the
 * Cache Components prerender, so the clock is read after `connection()`: a small dynamic hole
 * filled per request.
 */
export async function CopyrightSlot() {
  await connection();
  const [t, shop] = await Promise.all([getTranslations("footer"), getShop()]);
  return t("copyright", { year: new Date().getFullYear(), shopName: shop.name });
}
