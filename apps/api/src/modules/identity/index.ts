// Public surface of the `identity` module (ARCHITECTURE.md §2): other modules import from here
// only. `password.ts` stays internal until a second module needs it.

export type {
  AccountRegisterError,
  AccountRegisterErrorCode,
  AccountRegisterInput,
  PasswordError,
} from "./accounts.ts";
export {
  cleanAccountRegisterInput,
  hashRegistrationPassword,
  registerCustomer,
  validateNewPassword,
} from "./accounts.ts";
export {
  accountConfirmationHandler,
  accountConfirmationQueue,
  confirmAccount,
  confirmationUrl,
  enqueueAccountConfirmation,
  readAllowedClientHosts,
  renderAccountConfirmation,
  validateRedirectUrl,
} from "./confirmation.ts";
export type {
  CustomerError,
  CustomerErrorCode,
  CustomerInput,
  CustomerListArgs,
  CustomerPage,
  CustomerResult,
  UserSortField,
} from "./customers.ts";
export {
  createCustomer,
  deleteCustomers,
  getUserForStaff,
  InvalidCustomerCursorError,
  listCustomers,
  updateCustomer,
} from "./customers.ts";
export type { LoginResult } from "./login.ts";
export { authenticate } from "./login.ts";
export type { SetPasswordResult } from "./passwordReset.ts";
export {
  passwordResetHandler,
  passwordResetQueue,
  RESET_PASSWORD_LOCK_TIME_SECONDS,
  renderPasswordReset,
  requestPasswordReset,
  setPassword,
} from "./passwordReset.ts";
export type { Permission } from "./permissions.ts";
export { getEffectivePermissions, PERMISSION_NAMES, PERMISSIONS } from "./permissions.ts";
export type { CreatedSession, SessionUser } from "./sessions.ts";
export {
  createSession,
  getSessionUser,
  revokeSession,
  revokeUserSessions,
  SESSION_USER_COLUMNS,
} from "./sessions.ts";
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
export type { TokenUser } from "./tokens.ts";
export {
  ACCOUNT_CONFIRM_SALT,
  checkToken,
  makeToken,
  PASSWORD_RESET_SALT,
  readSecretKey,
} from "./tokens.ts";
export type { CreateSuperuserInput } from "./users.ts";
export {
  CreateSuperuserError,
  createSuperuser,
  getActiveUserIdByEmail,
  getUsersByIds,
} from "./users.ts";
