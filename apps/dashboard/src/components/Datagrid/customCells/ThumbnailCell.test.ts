// @vitest-environment jsdom
// Adapted from saleor-dashboard: src/components/Datagrid/customCells/ThumbnailCell.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The renderer is canvas-only, so the test feeds it a mocked 2D context and image loader.
import { describe, expect, it, vi } from "vitest";

import { thumbnailCell } from "./cells";
import { thumbnailCellRenderer } from "./ThumbnailCell";

const createDrawArgs = ({
  image,
  loadOrGetImage = vi.fn(),
}: {
  image?: CanvasImageSource;
  loadOrGetImage?: ReturnType<typeof vi.fn>;
}) => {
  if (image !== undefined) {
    loadOrGetImage.mockReturnValue(image);
  }

  return {
    ctx: {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      globalAlpha: 1,
    },
    rect: { x: 0, y: 0, width: 200, height: 40 },
    theme: {
      borderColor: "#ccc",
      textDark: "#111",
      textLight: "#888888",
    },
    imageLoader: { loadOrGetImage },
    col: 0,
    row: 1,
  };
};

describe("ThumbnailCell", () => {
  it("draws the empty image icon when there is no thumbnail", () => {
    const icon = {} as CanvasImageSource;
    const loadOrGetImage = vi.fn();
    const args = createDrawArgs({ image: icon, loadOrGetImage });
    const cell = thumbnailCell("Bean Juice", "");

    thumbnailCellRenderer.draw(args as never, cell);

    expect(loadOrGetImage).toHaveBeenCalledWith(
      expect.stringContaining("data:image/svg+xml"),
      0,
      1,
    );
    expect(args.ctx.drawImage).toHaveBeenCalledWith(
      icon,
      expect.any(Number),
      expect.any(Number),
      16,
      16,
    );
    expect(args.ctx.fillText).toHaveBeenCalledWith(
      "Bean Juice",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("does not draw the empty icon while a thumbnail is still loading", () => {
    const loadOrGetImage = vi.fn().mockReturnValue(undefined);
    const args = createDrawArgs({ loadOrGetImage });
    const cell = thumbnailCell("Bean Juice", "https://example.com/thumb.png");

    thumbnailCellRenderer.draw(args as never, cell);

    expect(args.ctx.drawImage).not.toHaveBeenCalled();
    expect(args.ctx.fill).not.toHaveBeenCalled();
  });

  it("draws the loaded thumbnail and its name", () => {
    const image = {} as CanvasImageSource;
    const loadOrGetImage = vi.fn();
    const args = createDrawArgs({ image, loadOrGetImage });

    thumbnailCellRenderer.draw(args as never, thumbnailCell("Bean Juice", "https://x/thumb.png"));

    expect(loadOrGetImage).toHaveBeenCalledWith("https://x/thumb.png", 0, 1);
    expect(args.ctx.drawImage).toHaveBeenCalledWith(image, 5, 5, 30, 30);
    expect(args.ctx.fillText).toHaveBeenCalledWith(
      "Bean Juice",
      expect.any(Number),
      expect.any(Number),
    );
  });
});
