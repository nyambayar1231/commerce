// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/account/addresses/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/lib/account/actions";
import { getAddressBook } from "@/lib/account/loaders";
import { AccountSectionSkeleton } from "@/ui/components/account/account-skeleton";
import { AccountLoadFailed } from "@/ui/components/account/account-unavailable";
import { AddressBook } from "@/ui/components/account/address-book";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("address.book");
  return { title: t("title") };
}

async function AddressesContent() {
  const [book, t] = await Promise.all([getAddressBook(), getTranslations("address.book")]);
  if (!book.ok) return <AccountLoadFailed title={t("title")} />;
  return (
    <AddressBook
      book={book.data}
      saveAction={saveAddress}
      deleteAction={deleteAddress}
      setDefaultAction={setDefaultAddress}
    />
  );
}

export default function AccountAddressesPage() {
  return (
    <Suspense fallback={<AccountSectionSkeleton />}>
      <AddressesContent />
    </Suspense>
  );
}
