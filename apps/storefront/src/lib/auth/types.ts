// View-model types shared by the auth Server Actions (src/lib/auth/actions.ts) and the form
// components in src/ui, which may import only `@/lib/*/types` (ARCHITECTURE §10.3).

/** Keys of the `errors` message namespace that the auth flows can show. */
export type AuthErrorKey =
  | "required"
  | "invalid"
  | "unavailable"
  | "generic"
  | "invalidEmail"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordsMismatch"
  | "invalidCredentials"
  | "notConfirmed"
  | "inactive"
  | "tooManyAttempts"
  | "staffNotAllowed"
  | "linkInvalid";

export type AuthField = "email" | "password" | "confirm";

/** The state `useActionState` holds for an auth form. The password is never echoed back. */
export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: AuthErrorKey;
  fieldErrors?: Partial<Record<AuthField, AuthErrorKey>>;
  email?: string;
};

export type AuthAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;

export type CustomerSummary = { id: string; email: string; firstName: string; lastName: string };

/** What the header needs to know about the shopper. */
export type CurrentUser =
  | { status: "guest" }
  | { status: "unavailable" }
  | { status: "authenticated"; user: CustomerSummary };
