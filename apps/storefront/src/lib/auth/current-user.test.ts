import { beforeEach, describe, expect, it, vi } from "vitest";

const readSessionToken = vi.fn();
vi.mock("./cookies", () => ({ readSessionToken }));
const sessionQuery = vi.fn();
vi.mock("@/lib/api", () => ({ sessionQuery }));
// `cache` memoizes per request; outside a request it must just call through.
vi.mock("react", async (importActual) => ({
  ...(await importActual<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const { getCurrentUser } = await import("./current-user");
const me = { id: "u1", email: "a@b.mn", firstName: "Ану", lastName: "Бат", isStaff: false };

beforeEach(() => {
  readSessionToken.mockReset();
  sessionQuery.mockReset();
});

describe("getCurrentUser", () => {
  it("is a guest without calling the API when there is no session cookie", async () => {
    readSessionToken.mockResolvedValue(null);
    expect(await getCurrentUser()).toEqual({ status: "guest" });
    expect(sessionQuery).not.toHaveBeenCalled();
  });
  it("is a guest when the API no longer knows the session", async () => {
    readSessionToken.mockResolvedValue("tok");
    sessionQuery.mockResolvedValue({ ok: true, data: { me: null } });
    expect(await getCurrentUser()).toEqual({ status: "guest" });
  });
  it("is a guest for a staff session (defensive)", async () => {
    readSessionToken.mockResolvedValue("tok");
    sessionQuery.mockResolvedValue({ ok: true, data: { me: { ...me, isStaff: true } } });
    expect(await getCurrentUser()).toEqual({ status: "guest" });
  });
  it("is authenticated with the customer's name and email", async () => {
    readSessionToken.mockResolvedValue("tok");
    sessionQuery.mockResolvedValue({ ok: true, data: { me } });
    expect(await getCurrentUser()).toEqual({
      status: "authenticated",
      user: { id: "u1", email: "a@b.mn", firstName: "Ану", lastName: "Бат" },
    });
  });
  it("is unavailable when the API fails", async () => {
    readSessionToken.mockResolvedValue("tok");
    sessionQuery.mockResolvedValue({ ok: false, error: new Error("down") });
    expect(await getCurrentUser()).toEqual({ status: "unavailable" });
  });
});
