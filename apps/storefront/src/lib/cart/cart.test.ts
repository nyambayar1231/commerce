import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";

const readCheckoutToken = vi.fn();
vi.mock("./cookies", () => ({
  readCheckoutToken,
  checkoutGlobalId: (token: string) => `gid:${token}`,
}));
const sessionQuery = vi.fn();
vi.mock("@/lib/api", () => ({ sessionQuery }));
// `cache` memoizes per request; outside a request it must just call through.
vi.mock("react", async (importActual) => ({
  ...(await importActual<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const { getCart } = await import("./cart");

const TOKEN = "5b0c7f0e-1111-4222-8333-944455556666";
const checkout = {
  id: "c1",
  token: TOKEN,
  quantity: 2,
  isShippingRequired: true,
  lines: [
    {
      id: "l1",
      quantity: 2,
      variant: {
        id: "v1",
        name: "42",
        quantityAvailable: 13,
        product: { name: "Demo Boots", slug: "demo-boots", thumbnail: null },
      },
      unitPrice: { gross: { amount: 1000, currency: "MNT" } },
      totalPrice: { gross: { amount: 2000, currency: "MNT" } },
    },
  ],
  subtotalPrice: { gross: { amount: 2000, currency: "MNT" } },
};

beforeEach(() => {
  readCheckoutToken.mockReset();
  sessionQuery.mockReset();
});

describe("getCart", () => {
  it("is null without asking the API when there is no usable cookie", async () => {
    readCheckoutToken.mockResolvedValue(null);
    expect(await getCart()).toBeNull();
    expect(sessionQuery).not.toHaveBeenCalled();
  });

  it("is null when the API does not know the checkout", async () => {
    readCheckoutToken.mockResolvedValue(TOKEN);
    sessionQuery.mockResolvedValue({ ok: true, data: { checkout: null } });
    expect(await getCart()).toBeNull();
  });

  it("asks for the checkout by its global id and maps it", async () => {
    readCheckoutToken.mockResolvedValue(TOKEN);
    sessionQuery.mockResolvedValue({ ok: true, data: { checkout } });
    const cart = await getCart();
    expect(sessionQuery.mock.calls[0]?.[1]).toEqual({ variables: { id: `gid:${TOKEN}` } });
    expect(cart).toMatchObject({ token: TOKEN, quantity: 2, subtotal: "₮ 2,000" });
  });

  it("is unavailable, not empty, when the API fails", async () => {
    readCheckoutToken.mockResolvedValue(TOKEN);
    sessionQuery.mockResolvedValue({
      ok: false,
      error: new ApiError({ kind: "network", operation: "CartByToken", requestId: "r" }),
    });
    expect(await getCart()).toEqual({ status: "unavailable" });
  });
});
