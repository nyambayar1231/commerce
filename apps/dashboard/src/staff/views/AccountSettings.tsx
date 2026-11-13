// Adapted from saleor-dashboard: src/staff/views/StaffDetails.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The signed-in user's staff page (PLAN M11.2). The user comes from the session (useUser), so no
// query; a language change is saved, then the page reloads as Saleor's does.
import { useLocale } from "../../components/Locale/Locale";
import type { UserFragment } from "../../graphql/types.generated";
import { StaffDetailsPage } from "../components/StaffDetailsPage/StaffDetailsPage";

export const AccountSettings = ({ user }: { user: UserFragment }) => {
  const { locale, setLocale } = useLocale();

  return (
    <StaffDetailsPage
      staffMember={user}
      locale={locale}
      onLocaleChange={(next) => {
        setLocale(next);
        window.location.reload();
      }}
    />
  );
};
