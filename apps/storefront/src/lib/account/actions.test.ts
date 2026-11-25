import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh }));

const mutate = vi.fn();
vi.mock("@/lib/api", () => ({ mutate }));

const actions = await import("./actions");

const ok = <T>(data: T) => ({ ok: true as const, data });
const down = { ok: false as const, error: new Error("down") };
const idle = { status: "idle" as const };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const address = {
  firstName: " Бат ",
  lastName: "Болд",
  country: "mn",
  countryArea: "Улаанбаатар",
  city: "Сүхбаатар дүүрэг",
  cityArea: "1-р хороо",
  streetAddress1: "Энхтайваны өргөн чөлөө 5",
  phone: "99112233",
};

beforeEach(() => {
  mutate.mockReset();
  refresh.mockReset();
});

describe("saveAddress", () => {
  it("creates with the cleaned address (trimmed, country upper-cased) and refreshes", async () => {
    mutate.mockResolvedValue(ok({ accountAddressCreate: { errors: [] } }));
    const state = await actions.saveAddress(idle, form(address));
    expect(state).toEqual({ status: "success" });
    const [, options] = mutate.mock.calls[0] ?? [];
    expect(options.variables.input).toMatchObject({ firstName: "Бат", country: "MN" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("updates when the form carries an id, passing the id on for the API's ownership check", async () => {
    mutate.mockResolvedValue(ok({ accountAddressUpdate: { errors: [] } }));
    await actions.saveAddress(idle, form({ ...address, id: "QWRkcmVzczo5" }));
    const [, options] = mutate.mock.calls[0] ?? [];
    expect(options.variables.id).toBe("QWRkcmVzczo5");
  });

  it("answers invalid input with field errors and the values, without calling the API", async () => {
    const state = await actions.saveAddress(idle, form({ ...address, city: "", country: "ZZ" }));
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { city: "required", country: "invalid" },
      values: { firstName: " Бат " },
    });
    expect(mutate).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("maps the API's field errors back to the fields", async () => {
    mutate.mockResolvedValue(
      ok({ accountAddressCreate: { errors: [{ code: "INVALID", field: "phone" }] } }),
    );
    const state = await actions.saveAddress(idle, form(address));
    expect(state).toMatchObject({ status: "error", fieldErrors: { phone: "invalid" } });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("an API outage is the unavailable message, keeping what was typed", async () => {
    mutate.mockResolvedValue(down);
    expect(await actions.saveAddress(idle, form(address))).toMatchObject({
      status: "error",
      message: "unavailable",
      values: { lastName: "Болд" },
    });
  });
});

describe("deleteAddress", () => {
  it("deletes and refreshes", async () => {
    mutate.mockResolvedValue(ok({ accountAddressDelete: { errors: [] } }));
    expect(await actions.deleteAddress(idle, form({ id: "a1" }))).toEqual({ status: "success" });
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("refuses a missing id without calling the API", async () => {
    expect(await actions.deleteAddress(idle, form({}))).toMatchObject({ message: "notFound" });
    expect(mutate).not.toHaveBeenCalled();
  });
  it("another customer's address (the API says not found) is not found", async () => {
    mutate.mockResolvedValue(
      ok({ accountAddressDelete: { errors: [{ code: "NOT_FOUND", field: "id" }] } }),
    );
    expect(await actions.deleteAddress(idle, form({ id: "a1" }))).toMatchObject({
      status: "error",
      message: "notFound",
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("setDefaultAddress", () => {
  it("sets the default of a known type", async () => {
    mutate.mockResolvedValue(ok({ accountSetDefaultAddress: { errors: [] } }));
    expect(await actions.setDefaultAddress(idle, form({ id: "a1", type: "BILLING" }))).toEqual({
      status: "success",
    });
    expect(mutate.mock.calls[0]?.[1].variables).toEqual({ id: "a1", type: "BILLING" });
  });
  it("refuses an unknown type without calling the API", async () => {
    expect(await actions.setDefaultAddress(idle, form({ id: "a1", type: "OTHER" }))).toMatchObject({
      status: "error",
    });
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("updateName", () => {
  it("trims and saves the names", async () => {
    mutate.mockResolvedValue(ok({ accountUpdate: { errors: [] } }));
    const state = await actions.updateName(idle, form({ firstName: " Бат ", lastName: "Болд" }));
    expect(state).toMatchObject({ status: "success", values: { firstName: "Бат" } });
    expect(mutate.mock.calls[0]?.[1].variables.input).toEqual({
      firstName: "Бат",
      lastName: "Болд",
    });
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("an over-long name never reaches the API", async () => {
    const state = await actions.updateName(
      idle,
      form({ firstName: "a".repeat(257), lastName: "" }),
    );
    expect(state).toMatchObject({ status: "error", fieldErrors: { firstName: "tooLong" } });
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("changePassword", () => {
  const input = {
    oldPassword: "old-password",
    password: "new-password-1",
    confirm: "new-password-1",
  };

  it("sends the old and new password and never echoes them back", async () => {
    mutate.mockResolvedValue(ok({ passwordChange: { errors: [] } }));
    const state = await actions.changePassword(idle, form(input));
    expect(state).toEqual({ status: "success" });
    expect(mutate.mock.calls[0]?.[1].variables).toEqual({
      oldPassword: "old-password",
      newPassword: "new-password-1",
    });
  });

  it("a mismatching confirmation or short password stops before the API, with no values", async () => {
    const mismatch = await actions.changePassword(
      idle,
      form({ ...input, confirm: "other-password" }),
    );
    expect(mismatch).toEqual({ status: "error", fieldErrors: { confirm: "passwordsMismatch" } });
    const short = await actions.changePassword(
      idle,
      form({ ...input, password: "short", confirm: "short" }),
    );
    expect(short).toMatchObject({ fieldErrors: { password: "passwordTooShort" } });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("INVALID_CREDENTIALS is a wrong current password", async () => {
    mutate.mockResolvedValue(
      ok({
        passwordChange: { errors: [{ code: "INVALID_CREDENTIALS", field: "oldPassword" }] },
      }),
    );
    expect(await actions.changePassword(idle, form(input))).toEqual({
      status: "error",
      fieldErrors: { oldPassword: "wrongPassword" },
    });
  });

  it("the API's PASSWORD_TOO_SHORT lands on the new password", async () => {
    mutate.mockResolvedValue(
      ok({ passwordChange: { errors: [{ code: "PASSWORD_TOO_SHORT", field: "newPassword" }] } }),
    );
    expect(await actions.changePassword(idle, form(input))).toEqual({
      status: "error",
      fieldErrors: { password: "passwordTooShort" },
    });
  });

  it("an outage is the unavailable message", async () => {
    mutate.mockResolvedValue(down);
    expect(await actions.changePassword(idle, form(input))).toEqual({
      status: "error",
      message: "unavailable",
    });
  });
});
