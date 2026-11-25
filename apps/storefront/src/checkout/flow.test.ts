import { describe, expect, it } from "vitest";
import { effectiveStep, furthestStep, stepNumber } from "./flow";

const base = {
  hasEmail: true,
  hasShippingAddress: true,
  hasDeliveryMethod: true,
  isShippingRequired: true,
};

describe("furthestStep", () => {
  it("is contact until there is an email", () => {
    expect(furthestStep({ ...base, hasEmail: false })).toBe("contact");
    // Nothing later counts without the email.
    expect(
      furthestStep({
        ...base,
        hasEmail: false,
        hasShippingAddress: false,
        hasDeliveryMethod: false,
      }),
    ).toBe("contact");
  });

  it("is shipping until there is an address", () => {
    expect(furthestStep({ ...base, hasShippingAddress: false })).toBe("shipping");
  });

  it("is shipping until there is a delivery method, when shipping is required", () => {
    expect(furthestStep({ ...base, hasDeliveryMethod: false })).toBe("shipping");
    expect(furthestStep({ ...base, hasDeliveryMethod: false, isShippingRequired: false })).toBe(
      "payment",
    );
  });

  it("is payment when everything is there", () => {
    expect(furthestStep(base)).toBe("payment");
  });
});

describe("effectiveStep", () => {
  it("lets the shopper go back", () => {
    expect(effectiveStep("contact", base)).toBe("contact");
    expect(effectiveStep("shipping", base)).toBe("shipping");
    expect(effectiveStep("payment", base)).toBe("payment");
  });

  it("clamps a step beyond the furthest back to it", () => {
    expect(effectiveStep("payment", { ...base, hasShippingAddress: false })).toBe("shipping");
    expect(effectiveStep("shipping", { ...base, hasEmail: false })).toBe("contact");
    expect(effectiveStep("payment", { ...base, hasDeliveryMethod: false })).toBe("shipping");
  });

  it("sends an unknown or missing step to the furthest", () => {
    for (const requested of [undefined, null, "", "confirm", "PAYMENT", 3, ["payment"]]) {
      expect(effectiveStep(requested, { ...base, hasShippingAddress: false })).toBe("shipping");
    }
  });
});

describe("stepNumber", () => {
  it("counts from one", () => {
    expect(stepNumber("contact")).toBe(1);
    expect(stepNumber("payment")).toBe(3);
  });
});
