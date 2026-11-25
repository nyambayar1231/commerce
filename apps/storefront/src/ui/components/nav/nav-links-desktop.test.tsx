// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MenuItemView } from "@/lib/content/types";

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
      createElement("a", { href, ...rest }, children),
  };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string>) =>
    key === "viewAll" ? `Бүгд үзэх (${values?.label ?? ""})` : `${ns}.${key}`,
}));

const { NavLinksDesktop } = await import("./nav-links-desktop");

// The desktop dropdown's keyboard contract (the user-menu disclosure pattern): open on click,
// Escape closes and returns focus to the trigger, a pointerdown outside closes, and following a
// link closes the menu. Tab reaches the panel because it follows the trigger in the DOM.

const items: MenuItemView[] = [
  {
    id: "all-products",
    name: "Бүх бүтээгдэхүүн",
    href: "/products",
    external: false,
    children: [],
  },
  {
    id: "top",
    name: "Ангилалууд",
    href: "/categories/root",
    external: false,
    children: [
      {
        id: "mid",
        name: "Гоо сайхан",
        href: "/categories/goo-saihan",
        external: false,
        children: [
          {
            id: "leaf",
            name: "Нүүр будаг",
            href: "/categories/budag",
            external: false,
            children: [],
          },
        ],
      },
    ],
  },
  { id: "ext", name: "Facebook", href: "https://example.com", external: true, children: [] },
];

afterEach(() => {
  cleanup();
});

function dropdownTrigger(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Ангилалууд" });
}

describe("NavLinksDesktop", () => {
  it("renders childless top items as links, external ones as new-tab anchors", () => {
    render(<NavLinksDesktop items={items} />);
    expect(screen.getByRole("link", { name: "Бүх бүтээгдэхүүн" }).getAttribute("href")).toBe(
      "/products",
    );
    const external = screen.getByRole("link", { name: "Facebook" });
    expect(external.getAttribute("href")).toBe("https://example.com");
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("opens the dropdown on click and closes it on Escape, returning focus to the trigger", () => {
    render(<NavLinksDesktop items={items} />);
    const trigger = dropdownTrigger();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Нүүр будаг")).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).not.toBeNull();
    expect(screen.getByText("Нүүр будаг")).toBeTruthy();

    trigger.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Нүүр будаг")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes the dropdown on a pointerdown outside it", () => {
    render(<NavLinksDesktop items={items} />);
    const trigger = dropdownTrigger();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.mouseDown(document.body);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the dropdown when one of its links is followed", () => {
    render(<NavLinksDesktop items={items} />);
    const trigger = dropdownTrigger();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Нүүр будаг"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the panel of a second parent after the first one closes", () => {
    const twoParents: MenuItemView[] = [
      ...items,
      {
        id: "top2",
        name: "Туслах",
        href: "/pages/help",
        external: false,
        children: [
          {
            id: "leaf2",
            name: "Холбоо барих",
            href: "/pages/contact",
            external: false,
            children: [],
          },
        ],
      },
    ];
    render(<NavLinksDesktop items={twoParents} />);
    const first = dropdownTrigger();
    fireEvent.click(first);
    const second = screen.getByRole("button", { name: "Туслах" });
    // The first panel's outside handler closes it when the second trigger is pressed.
    fireEvent.mouseDown(second);
    fireEvent.click(second);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");
  });
});
