import type { Db } from "@commerce/db";
import { type CatalogLoaders, createCatalogLoaders } from "../modules/catalog/index.ts";
import { type CheckoutLoaders, createCheckoutLoaders } from "../modules/checkout/index.ts";
import {
  getEffectivePermissions,
  getSessionUser,
  type Permission,
  type SessionUser,
} from "../modules/identity/index.ts";
import { createInventoryLoaders, type InventoryLoaders } from "../modules/inventory/index.ts";
import { createPaymentLoaders, type PaymentLoaders } from "../modules/payments/index.ts";

// What every resolver receives as its third argument. Created once per request (see app.ts).
export interface Context {
  db: Db;
  // Batch loaders for nested fields, created once per request (they cache, so they must never be
  // shared across requests). Created eagerly: a DataLoader costs nothing until its first load.
  loaders: CatalogLoaders;
  inventoryLoaders: InventoryLoaders;
  checkoutLoaders: CheckoutLoaders;
  paymentLoaders: PaymentLoaders;
  // The logged-in user, or null for anonymous requests and ended sessions.
  user: SessionUser | null;
  // The token the request authenticated with (needed to revoke it on logout), or null.
  sessionToken: string | null;
  // The user's effective permissions, loaded on first use and then reused for the request (as
  // Saleor caches `User.effective_permissions`). Empty for anonymous requests.
  permissions: () => Promise<readonly Permission[]>;
  // Absolute base URL of the API for links we build (thumbnail proxy URLs). `PUBLIC_URL` when
  // set (trailing slashes stripped), else the request's origin.
  publicUrl: string;
  // Adds a `Set-Cookie` header to this request's response (app.ts).
  setCookie: (header: string) => void;
}

// Name of the HttpOnly cookie holding the session token (ADR-0006). Set by login in M1.1.5.
export const SESSION_COOKIE = "session";

// The session token of a request: `Authorization: Bearer <token>` (scripts, tests) wins over the
// session cookie (browsers). ARCHITECTURE.md §5.1 step 2.
export function sessionTokenOf(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
    return match?.[1] ?? null;
  }
  return cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
}

// `HttpOnly` keeps it away from JavaScript; `SameSite=Lax` plus the CSRF header covers cross-site
// requests; `Secure` (browsers also accept it on http://localhost). ADR-0006.
export function sessionCookie(token: string, expiresAt: Date): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Expires=${expiresAt.toUTCString()}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function createContext(db: Db, request: Request): Promise<Omit<Context, "setCookie">> {
  const sessionToken = sessionTokenOf(request);
  const user = sessionToken === null ? null : await getSessionUser(db, sessionToken);
  let permissions: Promise<readonly Permission[]> | undefined;
  return {
    db,
    loaders: createCatalogLoaders(db),
    inventoryLoaders: createInventoryLoaders(db),
    checkoutLoaders: createCheckoutLoaders(db),
    paymentLoaders: createPaymentLoaders(db),
    user,
    sessionToken: user === null ? null : sessionToken,
    permissions: () => {
      if (user === null) return Promise.resolve([]);
      permissions ??= getEffectivePermissions(db, user.id);
      return permissions;
    },
    publicUrl: publicUrlOf(request),
  };
}

/** Saleor's `PUBLIC_URL`, falling back to the request's origin (ADR-0014 thumbnail URLs). */
function publicUrlOf(request: Request): string {
  const configured = process.env.PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

function cookieValue(header: string | null, name: string): string | null {
  if (header === null) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}
