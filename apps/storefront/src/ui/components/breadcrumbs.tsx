// Adapted from saleor-storefront: src/ui/components/breadcrumbs.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  ariaLabel: string;
  className?: string;
}

/**
 * Functional chrome breadcrumbs. The last item is the current page and renders as plain text;
 * every item before it is a link. Item hrefs are already built by the page (plain paths).
 */
export function Breadcrumbs({ items, ariaLabel, className }: BreadcrumbsProps) {
  return (
    <nav aria-label={ariaLabel} className={cn("text-sm text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const { name, href } = item;

          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: crumbs can repeat a name, so the index disambiguates
              key={`${name}-${index}`}
              className="flex items-center gap-1.5"
            >
              {index > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
              {href !== undefined && !isLast ? (
                <Link href={href} className="transition-colors hover:text-foreground">
                  {name}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{name}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
