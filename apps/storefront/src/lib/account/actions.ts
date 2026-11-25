"use server";

import { cleanAddress } from "@commerce/contracts";
import { refresh } from "next/cache";
import {
  AccountAddressCreateDocument,
  AccountAddressDeleteDocument,
  AccountAddressUpdateDocument,
  AccountSetDefaultAddressDocument,
  AccountUpdateDocument,
  type AddressInput,
  PasswordChangeDocument,
} from "@/gql/graphql";
import { mutate } from "@/lib/api";
import { textField } from "@/lib/auth/validation";
import type {
  AddressActionState,
  PasswordActionState,
  ProfileActionState,
  SimpleActionState,
} from "./types";
import {
  addressErrorsFromApi,
  readAddressValues,
  validateAddress,
  validatePasswordChange,
  validateProfile,
} from "./validation";

// Account Server Actions (ARCHITECTURE §10.10). Next checks each action's Origin against the host.
// An address id from the browser is passed on as is: the API refuses an address that is not the
// signed-in customer's (answering "not found" alike for unknown ids). Only async functions are
// exported: everything exported here is callable from a browser.

const unavailable = { status: "error", message: "unavailable" } as const;

/** Save an address: creates it, or updates it when the form carries the address `id`. */
export async function saveAddress(
  _state: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const values = readAddressValues(formData);
  const id = textField(formData, "id");

  const errors = validateAddress(values);
  if (errors) return { status: "error", fieldErrors: errors, values };
  const cleaned = cleanAddress(values);
  if (!cleaned.ok) return { status: "error", message: "generic", values };
  // Clean values only: trimmed, the country code upper-cased.
  const input = cleaned.address as AddressInput;

  const result =
    id === ""
      ? await mutate(AccountAddressCreateDocument, { variables: { input } })
      : await mutate(AccountAddressUpdateDocument, { variables: { id, input } });
  if (!result.ok) return { ...unavailable, values };
  const apiErrors =
    "accountAddressCreate" in result.data
      ? result.data.accountAddressCreate.errors
      : result.data.accountAddressUpdate.errors;
  if (apiErrors.length > 0) return { status: "error", ...addressErrorsFromApi(apiErrors), values };

  refresh();
  return { status: "success" };
}

export async function deleteAddress(
  _state: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const id = textField(formData, "id");
  if (id === "") return { status: "error", message: "notFound" };
  const result = await mutate(AccountAddressDeleteDocument, { variables: { id } });
  if (!result.ok) return unavailable;
  const errors = result.data.accountAddressDelete.errors;
  if (errors.length > 0) {
    return { status: "error", message: errors[0]?.code === "NOT_FOUND" ? "notFound" : "generic" };
  }
  refresh();
  return { status: "success" };
}

export async function setDefaultAddress(
  _state: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const id = textField(formData, "id");
  const type = textField(formData, "type");
  if (id === "" || (type !== "SHIPPING" && type !== "BILLING")) {
    return { status: "error", message: "notFound" };
  }
  const result = await mutate(AccountSetDefaultAddressDocument, { variables: { id, type } });
  if (!result.ok) return unavailable;
  const errors = result.data.accountSetDefaultAddress.errors;
  if (errors.length > 0) {
    return { status: "error", message: errors[0]?.code === "NOT_FOUND" ? "notFound" : "generic" };
  }
  refresh();
  return { status: "success" };
}

export async function updateName(
  _state: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const values = {
    firstName: textField(formData, "firstName").trim(),
    lastName: textField(formData, "lastName").trim(),
  };
  const errors = validateProfile(values);
  if (errors) return { status: "error", fieldErrors: errors, values };

  const result = await mutate(AccountUpdateDocument, { variables: { input: values } });
  if (!result.ok) return { ...unavailable, values };
  const apiErrors = result.data.accountUpdate.errors;
  if (apiErrors.length > 0) {
    const field = apiErrors[0]?.field;
    return field === "firstName" || field === "lastName"
      ? { status: "error", fieldErrors: { [field]: "invalid" }, values }
      : { status: "error", message: "generic", values };
  }
  refresh();
  return { status: "success", values };
}

export async function changePassword(
  _state: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const input = {
    oldPassword: textField(formData, "oldPassword"),
    password: textField(formData, "password"),
    confirm: textField(formData, "confirm"),
  };
  const errors = validatePasswordChange(input);
  if (errors) return { status: "error", fieldErrors: errors };

  const result = await mutate(PasswordChangeDocument, {
    variables: { oldPassword: input.oldPassword, newPassword: input.password },
  });
  if (!result.ok) return unavailable;
  const first = result.data.passwordChange.errors[0];
  if (first) {
    if (first.code === "INVALID_CREDENTIALS") {
      return { status: "error", fieldErrors: { oldPassword: "wrongPassword" } };
    }
    if (first.code === "PASSWORD_TOO_SHORT") {
      return { status: "error", fieldErrors: { password: "passwordTooShort" } };
    }
    if (first.code === "INVALID" && first.field === "newPassword") {
      return { status: "error", fieldErrors: { password: "invalid" } };
    }
    return { status: "error", message: "generic" };
  }
  return { status: "success" };
}
