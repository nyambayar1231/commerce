// Adapted from saleor-storefront: src/ui/components/account/{addresses-page,address-card}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import type { AddressAction, AddressBookView, SimpleAction } from "@/lib/account/types";
import { AddressCard } from "@/ui/components/address/address-card";
import { AddressDialog } from "@/ui/components/address/address-dialog";
import { SetDefaultButton } from "./set-default-button";

/** The address book: a card per address with edit, delete and "make default" (Server Actions as props). */
export function AddressBook({
  book,
  saveAction,
  deleteAction,
  setDefaultAction,
}: {
  book: AddressBookView;
  saveAction: AddressAction;
  deleteAction: SimpleAction;
  setDefaultAction: SimpleAction;
}) {
  const t = useTranslations("address.book");
  const { addresses, countries } = book;
  const add = <AddressDialog countries={countries} saveAction={saveAction} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-balance text-h1">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {addresses.length > 0 ? add : null}
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">{t("empty")}</p>
          <div className="mt-4 flex justify-center">{add}</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              actions={
                <AddressDialog
                  address={address}
                  countries={countries}
                  saveAction={saveAction}
                  deleteAction={deleteAction}
                />
              }
              footer={
                !address.isDefaultShipping || !address.isDefaultBilling ? (
                  <>
                    {address.isDefaultShipping ? null : (
                      <SetDefaultButton
                        addressId={address.id}
                        type="SHIPPING"
                        action={setDefaultAction}
                      />
                    )}
                    {address.isDefaultBilling ? null : (
                      <SetDefaultButton
                        addressId={address.id}
                        type="BILLING"
                        action={setDefaultAction}
                      />
                    )}
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
