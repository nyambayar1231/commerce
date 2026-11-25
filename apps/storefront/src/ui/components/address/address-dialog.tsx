"use client";

// Adapted from saleor-storefront: src/ui/components/account/{address-form-dialog,address-actions}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Pencil, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  AddressAction,
  AddressView,
  CountryOption,
  SimpleAction,
  SimpleActionState,
} from "@/lib/account/types";
import { Button } from "@/ui/components/ui/button";
import { AddressForm } from "./address-form";
import { FormMessage } from "./form-field";

const idle: SimpleActionState = { status: "idle" };

/** Delete with a confirmation step; closes the dialog once the address is gone. */
function DeleteAddress({
  addressId,
  action,
  onDone,
}: {
  addressId: string;
  action: SimpleAction;
  onDone: () => void;
}) {
  const t = useTranslations("address.book");
  const [state, formAction, pending] = useActionState(action, idle);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  return (
    <div className="mt-6 border-t border-border pt-4">
      <FormMessage message={state.status === "error" ? state.message : undefined} />
      {confirming ? (
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={addressId} />
          <p className="text-sm font-medium">{t("deleteConfirm")}</p>
          <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            {pending ? t("deleting") : t("deleteYes")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            {t("cancel")}
          </Button>
        </form>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          {t("delete")}
        </Button>
      )}
    </div>
  );
}

/**
 * Add or edit an address in a native `<dialog>` (the mobile menu's pattern: `showModal()` traps
 * focus, Escape closes it, focus returns to the trigger). The form mounts only while the dialog
 * is open, so each opening starts with fresh form state. Passing `address` edits it and adds the
 * delete step; the Server Actions arrive as props (ARCHITECTURE §10.3).
 */
export function AddressDialog({
  address,
  countries,
  saveAction,
  deleteAction,
}: {
  address?: AddressView;
  countries: CountryOption[];
  saveAction: AddressAction;
  deleteAction?: SimpleAction;
}) {
  const t = useTranslations("address.book");
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const onClose = () => setOpen(false);
    element.addEventListener("close", onClose);
    return () => element.removeEventListener("close", onClose);
  }, []);

  const close = useCallback(() => dialog.current?.close(), []);
  const show = () => {
    setOpen(true);
    dialog.current?.showModal();
  };
  const name = address ? `${address.firstName} ${address.lastName}`.trim() : "";

  return (
    <>
      {address ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={show}
          aria-label={t("editAria", { name })}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t("edit")}</span>
        </Button>
      ) : (
        <Button type="button" variant="outline-solid" size="sm" onClick={show}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("add")}
        </Button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-background p-0 backdrop:bg-foreground/50"
      >
        {open ? (
          <div className="max-h-[85dvh] overflow-y-auto p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 id={titleId} className="text-lg font-semibold">
                {address ? t("editTitle") : t("addTitle")}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={t("close")}
                className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-accent"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <AddressForm
              action={saveAction}
              countries={countries}
              address={address}
              onDone={close}
              onCancel={close}
            />
            {address && deleteAction ? (
              <DeleteAddress addressId={address.id} action={deleteAction} onDone={close} />
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
