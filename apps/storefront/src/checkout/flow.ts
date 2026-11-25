import { type CheckoutStep, STEPS } from "./types";

// The step flow of `/checkout?step=` (ARCHITECTURE §10.9): pure, so it is tested without a
// browser. A step is never skipped ahead: what the API still lacks decides how far we may go.

type Progress = {
  hasEmail: boolean;
  hasShippingAddress: boolean;
  hasDeliveryMethod: boolean;
  isShippingRequired: boolean;
};

/** The furthest step the checkout allows. */
export function furthestStep(checkout: Progress): CheckoutStep {
  if (!checkout.hasEmail) return "contact";
  if (!checkout.hasShippingAddress) return "shipping";
  if (checkout.isShippingRequired && !checkout.hasDeliveryMethod) return "shipping";
  return "payment";
}

function isStep(value: unknown): value is CheckoutStep {
  return typeof value === "string" && (STEPS as readonly string[]).includes(value);
}

/** The requested step, clamped back to the furthest allowed; unknown or missing → the furthest. */
export function effectiveStep(requested: unknown, checkout: Progress): CheckoutStep {
  const furthest = furthestStep(checkout);
  if (!isStep(requested)) return furthest;
  return STEPS.indexOf(requested) > STEPS.indexOf(furthest) ? furthest : requested;
}

/** The step's position, 1-based, for the header. */
export function stepNumber(step: CheckoutStep): number {
  return STEPS.indexOf(step) + 1;
}
