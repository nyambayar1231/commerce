// Adapted from saleor-storefront: src/ui/components/plp/filter-bar.tsx and ui/{badge,dropdown-menu}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonClassName } from "@/ui/components/ui/button";

// Paper's dropdown pills without Radix or client JavaScript: the pill is a `<button
// popovertarget>` and its panel a native `popover` (light dismiss and Escape included); every
// option is a plain `<Link>`. The panel sits under its pill with CSS anchor positioning; a browser
// without it shows the popover centred, which is still usable.

/** An option already worded: the bar turns the view model's choices into these. */
export type FilterChoice = {
  key: string;
  label: string;
  href: string;
  selected: boolean;
  /** Indentation steps, for nested categories. */
  level?: number;
};

/** Paper's small count badge. */
export function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-secondary px-1.5 text-xs font-semibold text-secondary-foreground">
      {count}
    </span>
  );
}

/** The options of one filter as links; the selected one gets a check mark and `aria-current`. */
export function FilterChoiceList({
  choices,
  className,
}: {
  choices: FilterChoice[];
  className?: string;
}) {
  return (
    <ul className={className}>
      {choices.map((choice) => (
        <li key={choice.key}>
          <Link
            href={choice.href}
            aria-current={choice.selected ? "true" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none",
              "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
              choice.selected && "font-medium",
            )}
            style={choice.level ? { paddingLeft: `${0.5 + choice.level}rem` } : undefined}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {choice.selected && <Check className="h-4 w-4" aria-hidden="true" />}
            </span>
            <span className="flex-1">{choice.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface FilterPillProps {
  /** Unique within the page: the popover's id and the anchor's name. */
  id: string;
  label: string;
  /** Paper's badge: how many values of this filter are set. */
  count: number;
  /** The panel's heading (Paper's dropdown label). */
  heading: string;
  choices: FilterChoice[];
  className?: string;
}

export function FilterPill({ id, label, count, heading, choices, className }: FilterPillProps) {
  const anchor = `--${id}`;
  return (
    <div className={className}>
      <button
        type="button"
        popoverTarget={id}
        className={buttonClassName({
          variant: "outline-solid",
          size: "sm",
          className: "shrink-0 bg-transparent",
        })}
        style={{ anchorName: anchor }}
      >
        {label}
        {count > 0 && <CountBadge count={count} />}
        <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
      </button>
      <div
        id={id}
        popover="auto"
        className={cn(
          "w-56 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
          "supports-[position-area:bottom]:[inset:auto] supports-[position-area:bottom]:[margin:0.25rem_0_0]",
        )}
        style={{
          positionAnchor: anchor,
          positionArea: "bottom span-right",
          positionTryFallbacks: "flip-inline",
        }}
      >
        <p className="px-2 py-1.5 text-sm font-semibold">{heading}</p>
        <div className="-mx-1 my-1 h-px bg-border" />
        <FilterChoiceList choices={choices} className="max-h-72 overflow-y-auto" />
      </div>
    </div>
  );
}
