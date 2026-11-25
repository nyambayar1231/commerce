// Adapted from saleor-storefront: src/ui/components/account/account-skeleton.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

/**
 * Mirrors the sidebar and overview layout so nothing jumps when the account loads.
 * `animate-skeleton-delayed` (Tailwind config) adds a short delay so fast loads show no flash.
 */
export function AccountSkeleton() {
  return (
    <div className="container-content animate-skeleton-delayed py-8 opacity-0" aria-hidden="true">
      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="hidden shrink-0 md:block md:w-52">
          <div className="mb-8 h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="mb-3 h-11 w-11 animate-pulse rounded-full bg-muted" />
          <div className="mb-1 h-5 w-28 animate-pulse rounded bg-muted" />
          <div className="mb-8 h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="space-y-1">
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/50" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/50" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/50" />
          </div>
        </aside>
        <div className="flex gap-2 overflow-hidden md:hidden">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-10 w-24 shrink-0 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-8">
          <div>
            <div className="h-8 w-56 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-[74px] animate-pulse rounded-lg border bg-muted/30" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fallback of a section page while its data loads (the sidebar is already on screen). */
export function AccountSectionSkeleton() {
  return (
    <div className="animate-skeleton-delayed space-y-6 opacity-0" aria-hidden="true">
      <div>
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-[74px] animate-pulse rounded-lg border bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
