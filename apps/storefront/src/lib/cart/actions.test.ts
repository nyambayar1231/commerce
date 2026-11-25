import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";

const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh }));

const mutate = vi.fn();
vi.mock("@/lib/api", () => ({ mutate }));

const readCheckoutToken = vi.fn();
const setCheckoutCookie = vi.fn();
vi.mock("./cookies", () => ({
  readCheckoutToken,
  setCheckoutCookie,
  checkoutGlobalId: (token: string) => `gid:${token}`,
}));

const { addToCart, removeLine, updateLine } = await import("./actions");

const TOKEN = "5b0c7f0e-1111-4222-8333-944455556666";
const NEW_TOKEN = "aaaaaaaa-1111-4222-8333-944455556666";
const VARIANT = "UHJvZHVjdFZhcmlhbnQ6MDFhMWNhY2E";
const LINE = "Q2hlY2tvdXRMaW5lOjAxYTFjYWNh";

const operation = (doc: unknown) => /(?:mutation|query)\s+(\w+)/.exec(String(doc))?.[1];
const calls = (name: string) =>
  mutate.mock.calls.filter(([doc]) => operation(doc) === name) as [
    unknown,
    { variables: Record<string, unknown> },
  ][];
const checkout = (token = TOKEN) => ({ token });
const done = (field: string, token = TOKEN) => ({
  ok: true as const,
  data: { [field]: { checkout: checkout(token), errors: [] } },
});
const refused = (field: string, code: string, errorField: string | null = null) => ({
  ok: true as const,
  data: { [field]: { checkout: null, errors: [{ code, field: errorField, message: "m" }] } },
});
const apiError = (kind: "network" | "graphql") => ({
  ok: false as const,
  error: new ApiError({ kind, operation: "Op", requestId: "r" }),
});

/** `mutate` answers by operation name. */
function answers(map: Record<string, unknown>) {
  mutate.mockImplementation(async (doc: unknown) => map[operation(doc) ?? ""]);
}

beforeEach(() => {
  for (const fn of [refresh, mutate, readCheckoutToken, setCheckoutCookie]) fn.mockReset();
  readCheckoutToken.mockResolvedValue(TOKEN);
});

describe("addToCart", () => {
  it.each([
    ["not an id", "not an id!", 1, "notAvailable"],
    ["empty id", "", 1, "notAvailable"],
    ["zero", VARIANT, 0, "invalidQuantity"],
    ["negative", VARIANT, -1, "invalidQuantity"],
    ["fractional", VARIANT, 1.5, "invalidQuantity"],
    ["over 99", VARIANT, 100, "invalidQuantity"],
  ])("refuses %s without calling the API", async (_name, id, quantity, message) => {
    expect(await addToCart(id, quantity)).toEqual({ status: "error", message });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("adds to the checkout in the cookie, renews the cookie and refreshes", async () => {
    answers({ CheckoutLinesAdd: done("checkoutLinesAdd") });
    expect(await addToCart(VARIANT)).toEqual({ status: "success" });
    expect(calls("CheckoutLinesAdd")[0]?.[1].variables).toEqual({
      id: `gid:${TOKEN}`,
      lines: [{ variantId: VARIANT, quantity: 1 }],
    });
    expect(calls("CheckoutCreate")).toHaveLength(0);
    expect(setCheckoutCookie).toHaveBeenCalledWith(TOKEN);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("creates the checkout and sets the cookie when there is no cookie", async () => {
    readCheckoutToken.mockResolvedValue(null);
    answers({ CheckoutCreate: done("checkoutCreate", NEW_TOKEN) });
    expect(await addToCart(VARIANT, 3)).toEqual({ status: "success" });
    expect(calls("CheckoutLinesAdd")).toHaveLength(0);
    expect(calls("CheckoutCreate")[0]?.[1].variables).toEqual({
      input: { lines: [{ variantId: VARIANT, quantity: 3 }] },
    });
    expect(setCheckoutCookie).toHaveBeenCalledWith(NEW_TOKEN);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("creates a new checkout when the cookie's checkout is completed", async () => {
    answers({
      CheckoutLinesAdd: refused("checkoutLinesAdd", "INVALID", "id"),
      CheckoutCreate: done("checkoutCreate", NEW_TOKEN),
    });
    expect(await addToCart(VARIANT)).toEqual({ status: "success" });
    expect(setCheckoutCookie).toHaveBeenCalledWith(NEW_TOKEN);
  });

  it("creates a new checkout when the API does not know the cookie's checkout", async () => {
    answers({
      CheckoutLinesAdd: apiError("graphql"),
      CartByToken: { ok: true, data: { checkout: null } },
      CheckoutCreate: done("checkoutCreate", NEW_TOKEN),
    });
    expect(await addToCart(VARIANT)).toEqual({ status: "success" });
    expect(calls("CheckoutCreate")).toHaveLength(1);
    expect(setCheckoutCookie).toHaveBeenCalledWith(NEW_TOKEN);
  });

  it("keeps a living cart when the GraphQL error is about the request, not the checkout", async () => {
    answers({
      CheckoutLinesAdd: apiError("graphql"),
      CartByToken: { ok: true, data: { checkout: { id: "x" } } },
    });
    expect(await addToCart(VARIANT)).toEqual({ status: "error", message: "notAvailable" });
    expect(calls("CheckoutCreate")).toHaveLength(0);
    expect(setCheckoutCookie).not.toHaveBeenCalled();
  });

  it("does not create a checkout when the API is down", async () => {
    answers({ CheckoutLinesAdd: apiError("network") });
    expect(await addToCart(VARIANT)).toEqual({ status: "error", message: "unavailable" });
    expect(calls("CheckoutCreate")).toHaveLength(0);
    expect(setCheckoutCookie).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["INSUFFICIENT_STOCK", "insufficientStock"],
    ["QUANTITY_GREATER_THAN_LIMIT", "quantityLimit"],
    ["PRODUCT_NOT_PUBLISHED", "notAvailable"],
    ["ZERO_QUANTITY", "invalidQuantity"],
    ["INVALID", "invalidQuantity"],
    ["NOT_FOUND", "notAvailable"],
    ["SOMETHING_ELSE", "generic"],
  ])("maps the API's %s to %s", async (code, message) => {
    answers({ CheckoutLinesAdd: refused("checkoutLinesAdd", code, "quantity") });
    expect(await addToCart(VARIANT)).toEqual({ status: "error", message });
    expect(setCheckoutCookie).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("maps a refusal to create the same way and an outage to unavailable", async () => {
    readCheckoutToken.mockResolvedValue(null);
    answers({ CheckoutCreate: refused("checkoutCreate", "INSUFFICIENT_STOCK", "quantity") });
    expect(await addToCart(VARIANT)).toEqual({ status: "error", message: "insufficientStock" });
    answers({ CheckoutCreate: apiError("network") });
    expect(await addToCart(VARIANT)).toEqual({ status: "error", message: "unavailable" });
  });
});

describe("updateLine", () => {
  it.each([
    ["bad id", "no good!", 1, "notAvailable"],
    ["negative", LINE, -1, "invalidQuantity"],
    ["fractional", LINE, 2.5, "invalidQuantity"],
    ["over 99", LINE, 100, "invalidQuantity"],
  ])("refuses %s without calling the API", async (_name, id, quantity, message) => {
    expect(await updateLine(id, quantity)).toEqual({ status: "error", message });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("updates the quantity of one line and refreshes", async () => {
    answers({ CheckoutLinesUpdate: done("checkoutLinesUpdate") });
    expect(await updateLine(LINE, 4)).toEqual({ status: "success" });
    expect(calls("CheckoutLinesUpdate")[0]?.[1].variables).toEqual({
      id: `gid:${TOKEN}`,
      lines: [{ lineId: LINE, quantity: 4 }],
    });
    expect(setCheckoutCookie).toHaveBeenCalledWith(TOKEN);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("deletes the line when the quantity is 0", async () => {
    answers({ CheckoutLinesDelete: done("checkoutLinesDelete") });
    expect(await updateLine(LINE, 0)).toEqual({ status: "success" });
    expect(calls("CheckoutLinesUpdate")).toHaveLength(0);
    expect(calls("CheckoutLinesDelete")[0]?.[1].variables).toEqual({
      id: `gid:${TOKEN}`,
      linesIds: [LINE],
    });
  });

  it("is generic without a cookie, and never creates a checkout", async () => {
    readCheckoutToken.mockResolvedValue(null);
    expect(await updateLine(LINE, 2)).toEqual({ status: "error", message: "generic" });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("maps the API's errors; a completed checkout is generic", async () => {
    answers({ CheckoutLinesUpdate: refused("checkoutLinesUpdate", "INSUFFICIENT_STOCK") });
    expect(await updateLine(LINE, 99)).toEqual({ status: "error", message: "insufficientStock" });
    answers({ CheckoutLinesUpdate: refused("checkoutLinesUpdate", "INVALID", "id") });
    expect(await updateLine(LINE, 2)).toEqual({ status: "error", message: "generic" });
    answers({ CheckoutLinesUpdate: apiError("network") });
    expect(await updateLine(LINE, 2)).toEqual({ status: "error", message: "unavailable" });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("removeLine", () => {
  it("removes the line and refreshes", async () => {
    answers({ CheckoutLinesDelete: done("checkoutLinesDelete") });
    expect(await removeLine(LINE)).toEqual({ status: "success" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses a bad id, is generic without a cookie, maps errors", async () => {
    expect(await removeLine("no good!")).toEqual({ status: "error", message: "notAvailable" });
    readCheckoutToken.mockResolvedValue(null);
    expect(await removeLine(LINE)).toEqual({ status: "error", message: "generic" });
    readCheckoutToken.mockResolvedValue(TOKEN);
    answers({ CheckoutLinesDelete: refused("checkoutLinesDelete", "NOT_FOUND", "linesIds") });
    expect(await removeLine(LINE)).toEqual({ status: "error", message: "notAvailable" });
    answers({ CheckoutLinesDelete: apiError("network") });
    expect(await removeLine(LINE)).toEqual({ status: "error", message: "unavailable" });
    expect(refresh).not.toHaveBeenCalled();
  });
});
