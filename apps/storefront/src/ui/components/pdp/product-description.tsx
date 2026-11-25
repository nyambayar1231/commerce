// Adapted from saleor-storefront: src/ui/components/pdp/product-attributes.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { RichTextBlock } from "@/lib/content/types";
import { RichText } from "@/ui/components/rich-text";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui/components/ui/accordion";

/**
 * The description as Paper's collapsible row under the gallery, open by default. A product
 * without a description has no row at all (never an empty heading).
 */
export function ProductDescription({
  title,
  blocks,
  className,
}: {
  title: string;
  blocks: RichTextBlock[];
  className?: string;
}) {
  if (blocks.length === 0) return null;
  return (
    <div className={className}>
      <Accordion defaultValue={["description"]}>
        <AccordionItem value="description" className="border-t">
          <AccordionTrigger className="text-h3">{title}</AccordionTrigger>
          <AccordionContent className="text-base">
            <RichText blocks={blocks} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
