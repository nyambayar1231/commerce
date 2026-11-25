"use client";

// Adapted from saleor-storefront: src/ui/components/ui/{input,label}.tsx and account/address-form-dialog.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import { type InputHTMLAttributes, type ReactNode, useId } from "react";
import type { AccountErrorKey } from "@/lib/account/types";
import { cn } from "@/lib/utils";

export const inputClassName = cn(
  "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base",
  "ring-offset-background placeholder:text-muted-foreground md:text-sm",
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/** The form-level error, announced to screen readers. The live region is always rendered. */
export function FormMessage({ message }: { message?: AccountErrorKey }) {
  const t = useTranslations("errors");
  return (
    <div aria-live="polite">
      {message ? (
        <div role="alert" className="bg-destructive/10 rounded-md p-3 text-sm text-destructive">
          {t(message)}
        </div>
      ) : null}
    </div>
  );
}

/** A confirmation (name saved, password changed), announced to screen readers. */
export function FormNotice({ children }: { children?: ReactNode }) {
  return (
    <div aria-live="polite">
      {children ? (
        <p role="status" className="rounded-md bg-secondary p-3 text-sm text-success">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/** Label, control and its error (linked with `aria-describedby`). `children` replaces the input. */
export function FormField({
  name,
  label,
  error,
  hint,
  children,
  ...input
}: {
  name: string;
  label: string;
  error?: AccountErrorKey;
  hint?: string;
  children?: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "children">) {
  const t = useTranslations("errors");
  const id = `${useId()}-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children ? (
        children({ id, describedBy, invalid: Boolean(error) })
      ) : (
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClassName, error && "border-destructive")}
          {...input}
        />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
