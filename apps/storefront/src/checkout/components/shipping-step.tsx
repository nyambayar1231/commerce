"use client";

// Adapted from saleor-storefront: src/checkout/views/saleor-checkout/shipping-step.tsx and sections/shipping-address-section.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { AddressAction, AddressView, CountryOption } from "@/lib/account/types";
import { cn } from "@/lib/utils";
import { AddressCard } from "@/ui/components/address/address-card";
import { AddressForm } from "@/ui/components/address/address-form";
import { SubmitButton } from "@/ui/components/auth/auth-form-parts";
import type { CheckoutActionState, DeliveryAction, ShippingMethodView } from "../types";
import { StepMessage } from "./step-message";

const noop = () => {};
const idle: CheckoutActionState = { status: "idle" };

/** The delivery methods of the saved address, one radio each; inactive ones are disabled. */
function DeliveryMethods({
  methods,
  selectedId,
  chooseDelivery,
}: {
  methods: ShippingMethodView[];
  selectedId: string | null;
  chooseDelivery: DeliveryAction;
}) {
  const t = useTranslations("checkout.shipping");
  const [state, formAction] = useActionState(chooseDelivery, idle);
  const firstActive = methods.find((method) => method.active)?.id ?? null;
  const [chosen, setChosen] = useState(
    selectedId !== null && methods.some((method) => method.id === selectedId && method.active)
      ? selectedId
      : firstActive,
  );

  if (methods.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noMethods")}</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <StepMessage message={state.message} />
      <fieldset className="space-y-3">
        <legend className="sr-only">{t("methodTitle")}</legend>
        {methods.map((method) => (
          <label
            key={method.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
              chosen === method.id && "border-foreground",
              !method.active && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name="deliveryMethodId"
              value={method.id}
              checked={chosen === method.id}
              disabled={!method.active}
              onChange={() => setChosen(method.id)}
              className="mt-1"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{method.name}</span>
              {method.message !== "" ? (
                <span className="block text-xs text-muted-foreground">{method.message}</span>
              ) : null}
              {!method.active ? (
                <span className="block text-xs text-muted-foreground">
                  {t("unavailableMethod")}
                </span>
              ) : null}
            </span>
            <span className="text-sm font-medium tabular-nums">{method.price}</span>
          </label>
        ))}
      </fieldset>
      <SubmitButton label={t("continue")} pendingLabel={t("continuing")} />
    </form>
  );
}

/**
 * Shipping (ARCHITECTURE §10.9): the shared Mongolian address form (a customer may fill it from
 * a saved address), then, once the address is saved, the delivery methods for it.
 */
export function ShippingStep({
  countries,
  savedAddresses,
  address,
  fallbackAddress,
  methods,
  selectedMethodId,
  saveShippingAddress,
  chooseDelivery,
}: {
  countries: CountryOption[];
  savedAddresses: AddressView[];
  /** The checkout's shipping address; the delivery methods are for it. */
  address: AddressView | null;
  /** What the form starts from when the checkout has no address: the customer's default. */
  fallbackAddress: AddressView | null;
  methods: ShippingMethodView[];
  selectedMethodId: string | null;
  saveShippingAddress: AddressAction;
  chooseDelivery: DeliveryAction;
}) {
  const t = useTranslations("checkout.shipping");
  // The address the form starts from: a saved one the customer picked, else the given default.
  const [picked, setPicked] = useState<AddressView | null>(null);
  const start = picked ?? address ?? fallbackAddress ?? undefined;

  return (
    <section aria-labelledby="checkout-shipping-title" className="space-y-8">
      <div className="space-y-4">
        <h1 id="checkout-shipping-title" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        {savedAddresses.length > 0 ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t("savedTitle")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {savedAddresses.map((saved) => (
                <button
                  key={saved.id}
                  type="button"
                  onClick={() => setPicked(saved)}
                  aria-pressed={picked?.id === saved.id}
                  className={cn(
                    "rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    picked?.id === saved.id && "ring-2 ring-foreground",
                  )}
                >
                  <AddressCard address={saved} />
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <AddressForm
          key={picked?.id ?? address?.id ?? fallbackAddress?.id ?? "new"}
          action={saveShippingAddress}
          countries={countries}
          address={start}
          onDone={noop}
          submitLabel={t("save")}
          pendingLabel={t("saving")}
        />
      </div>

      {address !== null ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("methodTitle")}</h2>
          <DeliveryMethods
            key={methods.map((method) => method.id).join("|")}
            methods={methods}
            selectedId={selectedMethodId}
            chooseDelivery={chooseDelivery}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("methodHint")}</p>
      )}

      <p className="text-sm">
        <Link
          href="/checkout?step=contact"
          className="text-muted-foreground underline underline-offset-2"
        >
          {t("back")}
        </Link>
      </p>
    </section>
  );
}
