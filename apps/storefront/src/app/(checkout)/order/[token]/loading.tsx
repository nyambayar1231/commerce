// The order route's loading state: the same skeleton as the content island's fallback in `page.tsx`.

import { CheckoutSkeleton } from "@/checkout/components/checkout-skeleton";

export default function Loading() {
  return <CheckoutSkeleton />;
}
