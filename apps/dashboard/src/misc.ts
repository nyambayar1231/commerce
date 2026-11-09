// Adapted from saleor-dashboard: src/misc.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the helpers the dashboard uses so far.

interface NamedUser {
  email: string;
  firstName: string;
  lastName: string;
}

export function getUserName(user: NamedUser | null | undefined, returnEmail?: boolean) {
  return user && (user.email || (user.firstName && user.lastName))
    ? user.firstName && user.lastName
      ? [user.firstName, user.lastName].join(" ")
      : returnEmail
        ? user.email
        : user.email.split("@")[0]
    : undefined;
}

export function getUserInitials(user?: NamedUser) {
  if (user?.firstName && user.lastName) {
    return (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
  }

  if (user?.email) {
    return user.email.slice(0, 2).toUpperCase();
  }

  return undefined;
}
