import type { AuthErrorKey, AuthField } from "./types";

// Same minimum as the API (apps/api/src/modules/identity/accounts.ts).
export const MIN_PASSWORD_LENGTH = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors = Partial<Record<AuthField, AuthErrorKey>>;

/** The form field as a string; a missing or non-text field is "". */
export function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function emailError(email: string): AuthErrorKey | undefined {
  if (email === "") return "required";
  return EMAIL.test(email) ? undefined : "invalidEmail";
}

function compact(errors: FieldErrors): FieldErrors | null {
  const present = Object.fromEntries(Object.entries(errors).filter(([, key]) => key !== undefined));
  return Object.keys(present).length > 0 ? (present as FieldErrors) : null;
}

/** Sign-in: a valid-looking email and a password. Returns the errors, or null when fine. */
export function validateLogin(input: { email: string; password: string }): FieldErrors | null {
  return compact({
    email: emailError(input.email),
    password: input.password === "" ? "passwordRequired" : undefined,
  });
}

/** A new password with its confirmation. */
export function validateNewPassword(input: {
  password: string;
  confirm: string;
}): FieldErrors | null {
  return compact({
    password:
      input.password === ""
        ? "passwordRequired"
        : input.password.length < MIN_PASSWORD_LENGTH
          ? "passwordTooShort"
          : undefined,
    confirm: input.password !== input.confirm ? "passwordsMismatch" : undefined,
  });
}

export function validateRegister(input: {
  email: string;
  password: string;
  confirm: string;
}): FieldErrors | null {
  return compact({ email: emailError(input.email), ...validateNewPassword(input) });
}

export function validateEmail(email: string): FieldErrors | null {
  return compact({ email: emailError(email) });
}
