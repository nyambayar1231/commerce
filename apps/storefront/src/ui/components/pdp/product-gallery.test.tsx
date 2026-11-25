// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import mn from "@/../messages/mn.json";
import type { ProductViewImage } from "@/lib/catalog/types";
import { ProductGallery } from "./product-gallery";

// The gallery's keyboard contract, checked at the DOM level (the acceptance criterion: the
// viewer opens on click, moves with the arrow keys, closes with Escape). jsdom has no
// `showModal` and keeps a non-open `<dialog>` display:none, so the dialog queries pass
// `{ hidden: true }`; the native modal behaviour (focus trap, the browser's Escape handling)
// is covered by the `<dialog>` element itself; this test pins the React behaviour around it.

afterEach(cleanup);

function image(id: string): ProductViewImage {
  return {
    id,
    alt: `Зураг ${id}`,
    thumb: `https://img/${id}/128.webp`,
    src: `https://img/${id}/1024.webp`,
    srcSet: `https://img/${id}/1024.webp 1024w, https://img/${id}/2048.webp 2048w`,
    large: `https://img/${id}/2048.webp`,
  };
}

function renderGallery(images: ProductViewImage[]) {
  return render(
    <NextIntlClientProvider locale="mn" messages={mn}>
      <ProductGallery images={images} productName="Ноолуур шарф" />
    </NextIntlClientProvider>,
  );
}

describe("ProductGallery", () => {
  it("opens the viewer on a stage click and shows the 2048 image", () => {
    renderGallery([image("m1"), image("m2")]);
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Зураг m1 — 1-р зургийг харах" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("https://img/m1/2048.webp");
    expect(screen.getByText("1 / 2")).not.toBeNull();
  });

  it("moves with the arrow keys and wraps around", () => {
    renderGallery([image("m1"), image("m2")]);
    fireEvent.click(screen.getByRole("button", { name: "Зураг m1 — 1-р зургийг харах" }));
    const dialog = screen.getByRole("dialog", { hidden: true });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2 / 2")).not.toBeNull();
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("https://img/m2/2048.webp");

    // At the last image the arrows wrap, like Paper's viewer.
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("1 / 2")).not.toBeNull();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("2 / 2")).not.toBeNull();
  });

  it("closes with Escape (the dialog's cancel) and with the close button", () => {
    renderGallery([image("m1"), image("m2")]);
    fireEvent.click(screen.getByRole("button", { name: "Зураг m1 — 1-р зургийг харах" }));
    const dialog = screen.getByRole("dialog", { hidden: true });

    // Escape on a native dialog fires "cancel"; the handler must end the viewer.
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();

    // It reopens from the stage, and the close button ends it too.
    fireEvent.click(screen.getByRole("button", { name: "Зураг m1 — 1-р зургийг харах" }));
    fireEvent.click(screen.getByRole("button", { name: "Хаах", hidden: true }));
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });
});
