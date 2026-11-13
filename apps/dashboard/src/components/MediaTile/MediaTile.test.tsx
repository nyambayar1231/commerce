// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { MediaTile } from "./MediaTile";

afterEach(cleanup);

const editLink = (): HTMLAnchorElement | null =>
  document.querySelector<HTMLAnchorElement>('[data-test-id="product-media-edit"]');

const renderTile = (props: Partial<Parameters<typeof MediaTile>[0]> = {}) =>
  render(
    <IntlProvider locale="en">
      <MemoryRouter>
        <MediaTile
          media={{ alt: "Front", url: "https://example.com/1.webp" }}
          editHref="/products/product-1/image/media-1"
          onDelete={() => undefined}
          {...props}
        />
      </MemoryRouter>
    </IntlProvider>,
  );

describe("MediaTile", () => {
  it("links a saved image's tile to its image page", () => {
    renderTile();

    expect(editLink()?.getAttribute("href")).toBe("/products/product-1/image/media-1");
    expect(document.querySelector('[data-test-id="product-media-delete"]')).toBeTruthy();
  });

  it("draws no edit link for a tile without a page (a pending upload)", () => {
    renderTile({ editHref: undefined, onDelete: undefined, loading: true });

    expect(editLink()).toBeNull();
  });

  it("hides the controls on the drag ghost's overlay", () => {
    renderTile({ disableOverlay: true });

    expect(editLink()).toBeNull();
  });
});
