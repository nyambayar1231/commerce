// Public surface of the `identity` module (ARCHITECTURE.md §2): other modules import from here
// only. `password.ts` stays internal until a second module needs it.

export type {
  AccountRegisterError,
  AccountRegisterErrorCode,
  AccountRegisterInput,
  AccountRegisterResult,
} from "./accounts.ts";
export {
  cleanAccountRegisterInput,
  hashRegistrationPassword,
  registerCustomer,
} from "./accounts.ts";
export type { LoginResult } from "./login.ts";
export { authenticate } from "./login.ts";
export type { Permission } from "./permissions.ts";
export { getEffectivePermissions, PERMISSION_NAMES, PERMISSIONS } from "./permissions.ts";
export type { CreatedSession, SessionUser } from "./sessions.ts";
export { createSession, getSessionUser, revokeSession } from "./sessions.ts";
export type {
  PermissionGroupCreateInput,
  PermissionGroupUpdateInput,
  Requestor,
  StaffCreateInput,
  StaffError,
  StaffErrorCode,
  StaffResult,
} from "./staff.ts";
export {
  createPermissionGroup,
  createStaffUser,
  NotFoundError,
  updatePermissionGroup,
} from "./staff.ts";
export type { CreateSuperuserInput } from "./users.ts";
export { CreateSuperuserError, createSuperuser, getUsersByIds } from "./users.ts";
