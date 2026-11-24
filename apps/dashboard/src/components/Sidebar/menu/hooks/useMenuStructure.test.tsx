// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMenuStructure } from "./useMenuStructure";

// The menu reads the signed-in user's permissions; the rest of the sidebar is layout.
const state = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock("../../../../auth/AuthProvider", () => ({
  useUser: () => ({
    user: { userPermissions: state.permissions.map((code) => ({ code })) },
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en">{children}</IntlProvider>
);

const renderMenu = () => renderHook(() => useMenuStructure(), { wrapper });

afterEach(() => {
  state.permissions = [];
});

describe("useMenuStructure", () => {
  it("shows Modeling → Models after Customers for a user who can manage pages", () => {
    state.permissions = ["MANAGE_PAGES", "MANAGE_PRODUCTS", "MANAGE_USERS"];
    const { result } = renderMenu();
    const ids = result.current.map((item) => item.id);

    expect(ids.indexOf("modeling")).toBe(ids.indexOf("customers") + 1);
    expect(result.current.find((item) => item.id === "modeling")).toMatchObject({
      label: "Modeling",
      url: "/models/",
      type: "itemGroup",
      permissions: ["MANAGE_PAGES"],
    });
    expect(result.current.find((item) => item.id === "modeling")?.children).toEqual([
      {
        id: "models",
        label: "Models",
        url: "/models/",
        type: "item",
        permissions: ["MANAGE_PAGES"],
      },
    ]);
  });

  it("hides the group without MANAGE_PAGES", () => {
    state.permissions = ["MANAGE_PRODUCTS", "MANAGE_ORDERS"];
    const { result } = renderMenu();

    expect(result.current.some((item) => item.id === "modeling")).toBe(false);
    expect(result.current.some((item) => item.id === "models")).toBe(false);
  });

  it("shows the group to a superuser, who has every permission", () => {
    state.permissions = ["MANAGE_PAGES", "MANAGE_PRODUCTS", "MANAGE_ORDERS", "MANAGE_MENUS"];
    const { result } = renderMenu();

    expect(result.current.find((item) => item.id === "modeling")?.children).toHaveLength(1);
  });
});
