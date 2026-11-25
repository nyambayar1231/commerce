// Adapted from saleor-storefront: src/ui/components/account/order-timeline.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import type { TimelineEntryView } from "@/lib/account/types";
import { cn } from "@/lib/utils";

/** The order's progress, newest first, from placed / fulfilled / canceled data only. */
export function OrderTimeline({ entries }: { entries: TimelineEntryView[] }) {
  const t = useTranslations("orders");
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border">
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">{t("timeline")}</h2>
      </div>
      <div className="px-5 py-4">
        <ol className="relative ml-3 border-l border-border">
          {entries.map((entry, index) => (
            <li key={`${entry.kind}-${entry.iso}`} className="relative mb-6 ml-6 last:mb-0">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -left-[calc(1.5rem+5px)] top-1 h-2.5 w-2.5 rounded-full border-2 border-background",
                  index === 0 ? "bg-foreground" : "bg-muted-foreground/40",
                )}
              />
              <p
                className={cn(
                  "text-sm",
                  index === 0 ? "font-semibold" : "font-medium text-muted-foreground",
                )}
              >
                {t(`timelineEntry.${entry.kind}`)}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {entry.kind === "fulfilled"
                  ? t("timelineEntry.fulfilledDescription", { count: entry.itemCount })
                  : t(`timelineEntry.${entry.kind}Description`)}
              </p>
              {entry.kind === "fulfilled" && entry.trackingNumber ? (
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {t("timelineEntry.tracking", { number: entry.trackingNumber })}
                </p>
              ) : null}
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                <time dateTime={entry.iso}>{entry.label}</time>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
