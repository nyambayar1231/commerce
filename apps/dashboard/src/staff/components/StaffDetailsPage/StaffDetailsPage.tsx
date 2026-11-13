// Adapted from saleor-dashboard: src/staff/components/StaffDetailsPage/StaffDetailsPage.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Account settings (PLAN M11.2): Saleor's staff details page of the signed-in user, minimal. The
// title is the user's name with the "Me" pill and the Active status; the content is the read-only profile card; the right sidebar has the
// "Dashboard language" card. No back link (there is no staff list yet), no form or savebar (nothing
// is editable), no status, permissions, password reset, navigation pins or metadata.
import { Box } from "@saleor/macaw-ui";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { DetailPageContent } from "../../../components/DetailPageContent/DetailPageContent";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import type { Locale } from "../../../components/Locale/Locale";
import { getUserName } from "../../../misc";
import { StaffPreferences } from "../StaffPreferences/StaffPreferences";
import { StaffProperties } from "../StaffProperties/StaffProperties";
import { StaffDetailsTitle } from "./StaffDetailsTitle";

interface StaffDetailsPageProps {
  staffMember: { email: string; firstName: string; lastName: string };
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export const StaffDetailsPage = ({
  staffMember,
  locale,
  onLocaleChange,
}: StaffDetailsPageProps) => (
  <DetailPageLayout>
    <TopNav title={<StaffDetailsTitle name={getUserName(staffMember, true)} />} />
    <DetailPageLayout.Content>
      <DetailPageContent>
        <StaffProperties data={staffMember} />
      </DetailPageContent>
    </DetailPageLayout.Content>
    <DetailPageLayout.RightSidebar paddingTop={6}>
      <Box display="flex" flexDirection="column" gap={4} paddingX={6}>
        <StaffPreferences locale={locale} onLocaleChange={onLocaleChange} />
      </Box>
    </DetailPageLayout.RightSidebar>
  </DetailPageLayout>
);
