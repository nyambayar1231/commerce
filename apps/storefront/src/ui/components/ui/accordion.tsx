"use client";

// Adapted from saleor-storefront: src/ui/components/ui/accordion.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ChevronDown } from "lucide-react";
import { createContext, type ReactNode, useContext, useId, useState } from "react";
import { cn } from "@/lib/utils";

// Paper's accordion without its separate item-context wrapper: an item owns its value, the root
// owns which values are open. The content is always in the HTML (collapsed with CSS only), so a
// default-open row is readable by crawlers and without JavaScript.

type AccordionContextValue = { openItems: string[]; toggle: (value: string) => void };
const AccordionContext = createContext<AccordionContextValue | null>(null);
const ItemContext = createContext<{ value: string; ids: string } | null>(null);

function useAccordion() {
  const context = useContext(AccordionContext);
  if (!context) throw new Error("Accordion parts must be used within <Accordion>");
  return context;
}

function useItem() {
  const item = useContext(ItemContext);
  if (!item)
    throw new Error("AccordionTrigger/AccordionContent must be used within <AccordionItem>");
  return item;
}

export function Accordion({
  type = "multiple",
  defaultValue = [],
  children,
  className,
}: {
  type?: "single" | "multiple";
  defaultValue?: string[];
  children: ReactNode;
  className?: string;
}) {
  const [openItems, setOpenItems] = useState<string[]>(defaultValue);
  const toggle = (value: string) =>
    setOpenItems((prev) => {
      if (prev.includes(value)) return prev.filter((item) => item !== value);
      return type === "single" ? [value] : [...prev, value];
    });
  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className={cn("w-full", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ids = useId();
  return (
    <ItemContext.Provider value={{ value, ids }}>
      <div className={cn("border-b", className)} data-value={value}>
        {children}
      </div>
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { openItems, toggle } = useAccordion();
  const { value, ids } = useItem();
  const isOpen = openItems.includes(value);
  return (
    <button
      type="button"
      id={`${ids}-trigger`}
      aria-expanded={isOpen}
      aria-controls={`${ids}-content`}
      data-state={isOpen ? "open" : "closed"}
      onClick={() => toggle(value)}
      className={cn(
        "flex w-full items-center justify-between py-4 text-left font-medium transition-all",
        className,
      )}
    >
      {children}
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
          isOpen && "rotate-180",
        )}
      />
    </button>
  );
}

export function AccordionContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { openItems } = useAccordion();
  const { value, ids } = useItem();
  const isOpen = openItems.includes(value);
  return (
    <section
      id={`${ids}-content`}
      aria-labelledby={`${ids}-trigger`}
      data-state={isOpen ? "open" : "closed"}
      inert={!isOpen}
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">
        <div className={cn("pb-4 text-sm", className)}>{children}</div>
      </div>
    </section>
  );
}
