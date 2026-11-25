// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MenuItemView } from "@/lib/content/types";

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
      createElement("a", { href, ...rest }, children),
  };
});
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

const { MobileMenu } = await import("./mobile-menu");

// The mobile dialog's contract (a native `<dialog>`, which jsdom does not implement): the stub
// below marks the dialog open and fires the `close` event, so the tests pin what the component
// does around the browser's own behaviour — `showModal()` moves focus into the dialog, Escape
// triggers the native `cancel` → `close`, and the `close` listener returns focus to the trigger.

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function openDialog(this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function closeDialog(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  });
});

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
];

afterEach(() => {
  cleanup();
});

function openMenu() {
  render(<MobileMenu items={items} />);
  const trigger = screen.getByRole("button", { name: "nav.mobileOpen" });
  fireEvent.click(trigger);
  return trigger;
}

describe("MobileMenu", () => {
  it("opens the dialog with showModal, its search form and the tree as nested lists", () => {
    const trigger = openMenu();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(trigger); // showModal() moved focus into the dialog
    // The `<search>` landmark (jsdom doesn't map its implicit role) wraps the plain GET form;
    // without JavaScript it still submits.
    const form = document.querySelector("search > form");
    expect(form?.getAttribute("action")).toBe("/search");
    expect(screen.getByLabelText("search.label").getAttribute("name")).toBe("q");
    expect(screen.getByRole("link", { name: "Гоо сайхан" }).getAttribute("href")).toBe(
      "/categories/goo-saihan",
    );
    expect(screen.getByRole("link", { name: "Нүүр будаг" })).toBeTruthy();
  });

  it("closes and returns focus to the trigger when a link is followed", () => {
    const trigger = openMenu();
    fireEvent.click(screen.getByRole("link", { name: "Нүүр будаг" }));
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });

  it("closes from the dialog's own close button, returning focus", () => {
    const trigger = openMenu();
    fireEvent.click(screen.getByRole("button", { name: "nav.mobileClose" }));
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });

  it("external links open in a new tab without a referrer", () => {
    render(
      <MobileMenu
        items={[
          {
            id: "ext",
            name: "Facebook",
            href: "https://example.com",
            external: true,
            children: [],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "nav.mobileOpen" }));
    const external = screen.getByRole("link", { name: "Facebook" });
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
