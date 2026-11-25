"use client";

// Adapted from saleor-storefront: src/ui/components/auth/auth-form-section.tsx, login-mode.tsx and sign-up-form.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { type InputHTMLAttributes, type ReactNode, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState, AuthErrorKey, AuthField } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/components/ui/button";

/** Card shell shared by the auth pages (Paper's `AuthFormSection` + card). */
export function AuthCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="container-content py-8 pb-24">
      <div className="mx-auto mt-8 w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-balance text-h1">{title}</h1>
            {intro ? <p className="mt-2 text-sm text-muted-foreground">{intro}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}

export const linkClassName =
  "font-medium text-foreground underline underline-offset-2 hover:no-underline";

/** The form-level error, announced to screen readers. The live region is always rendered. */
export function FormError({ state }: { state: AuthActionState }) {
  const t = useTranslations("errors");
  return (
    <div aria-live="polite">
      {state.status === "error" && state.message ? (
        <div role="alert" className="bg-destructive/10 rounded-md p-3 text-sm text-destructive">
          {t(state.message)}
        </div>
      ) : null}
    </div>
  );
}

export function fieldError(state: AuthActionState, field: AuthField): AuthErrorKey | undefined {
  return state.status === "error" ? state.fieldErrors?.[field] : undefined;
}

const FIELD_ICONS = { mail: Mail, lock: Lock, user: User } as const;

/**
 * Label, input and its error message (linked with `aria-describedby`). `icon` is Paper's leading
 * icon; a `type="password"` field also gets Paper's eye button (it never submits the form).
 */
export function Field({
  name,
  label,
  error,
  hint,
  icon,
  type,
  ...input
}: {
  name: string;
  label: string;
  error?: AuthErrorKey;
  hint?: string;
  icon?: keyof typeof FIELD_ICONS;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id">) {
  const t = useTranslations("errors");
  const tAuth = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const Icon = icon ? FIELD_ICONS[icon] : null;
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        {Icon ? (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
        ) : null}
        <input
          id={id}
          name={name}
          type={isPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base",
            "ring-offset-background placeholder:text-muted-foreground md:text-sm",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            Icon && "pl-10",
            isPassword && "pr-10",
            error && "border-destructive",
          )}
          {...input}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? tAuth("hidePassword") : tAuth("showPassword")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
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

/** Disabled while the action runs. Must sit inside the `<form>`. */
export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-12 w-full text-base font-semibold">
      {pending ? pendingLabel : label}
    </Button>
  );
}
