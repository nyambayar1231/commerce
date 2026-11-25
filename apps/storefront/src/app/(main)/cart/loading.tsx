// The cart route's loading state: the same skeleton as the content island's fallback in `page.tsx`.

import { CartPageSkeleton } from "@/ui/components/cart/cart-page-skeleton";

export default function Loading() {
  return (
    <section className="container-content py-8">
      <CartPageSkeleton />
    </section>
  );
}
