// Adapted from saleor-dashboard: src/staff/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the staff member page, which is Account settings when it is the signed-in user's own
// (PLAN M11.2). The staff list, its filters and dialogs come with the staff pages.
const staffSection = "/staff";

export const staffMemberDetailsPath = (id: string): string => `${staffSection}/${id}`;

export const staffMemberDetailsUrl = (id: string): string =>
  staffMemberDetailsPath(encodeURIComponent(id));
