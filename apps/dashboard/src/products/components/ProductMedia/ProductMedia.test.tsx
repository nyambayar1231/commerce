// @vitest-environment jsdom
import type { FetchResult } from "@apollo/client";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type {
  ProductMediaCreateMutation,
  ProductMediaFragment,
} from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { ProductMedia } from "./ProductMedia";

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("../../../hooks/useNotifier/useNotifier", () => ({
  useNotifier: () => notify,
}));

const savedMedia: ProductMediaFragment = {
  __typename: "ProductMedia",
  id: "media-1",
  alt: "Shoe",
  sortOrder: 0,
  type: "IMAGE",
  url: "https://example.com/shoe.png",
  oembedData: {},
};

const uploadSuccess = (mediaId: string): FetchResult<ProductMediaCreateMutation> =>
  ({
    data: {
      productMediaCreate: {
        __typename: "ProductMediaCreate",
        errors: [],
        media: { __typename: "ProductMedia", id: mediaId },
        product: { __typename: "Product", id: "product-1", media: [] },
      },
    },
  }) as unknown as FetchResult<ProductMediaCreateMutation>;

const byTestId = <T extends Element>(id: string): T | null =>
  document.querySelector<T>(`[data-test-id="${id}"]`);

const renderCard = (
  props: Partial<Parameters<typeof ProductMedia>[0]> = {},
): {
  onImageUpload: ReturnType<typeof vi.fn>;
  onImageDelete: ReturnType<typeof vi.fn>;
  onImagesUploadComplete: ReturnType<typeof vi.fn>;
} => {
  const onImageUpload = vi.fn(async () => uploadSuccess("media-new"));
  const onImageDelete = vi.fn(() => vi.fn());
  const onImagesUploadComplete = vi.fn();

  render(
    <ThemeProvider>
      <LocaleProvider>
        <ProductMedia
          media={[]}
          onImageUpload={onImageUpload}
          onImagesUploadComplete={onImagesUploadComplete}
          onImageDelete={onImageDelete}
          {...props}
        />
      </LocaleProvider>
    </ThemeProvider>,
  );

  return { onImageUpload, onImageDelete, onImagesUploadComplete };
};

beforeEach(() => {
  notify.mockClear();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:pending"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProductMedia", () => {
  it("shows the card header, the Upload button and Saleor's empty dropzone", () => {
    renderCard();

    expect(screen.getByText("Media")).toBeTruthy();
    expect(byTestId<HTMLButtonElement>("button-upload-image")?.textContent).toContain("Upload");
    expect(byTestId("product-media-dropzone")).not.toBeNull();
  });

  it("opens the hidden file input from the Upload button", () => {
    renderCard();

    const input = byTestId<HTMLInputElement>("product-media-file-input");
    const click = vi.spyOn(input as HTMLInputElement, "click");

    fireEvent.click(byTestId("button-upload-image") as HTMLButtonElement);

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("uploads a dropped image and shows a pending tile", async () => {
    const { onImageUpload } = renderCard();
    const file = new File(["image-bytes"], "shoe.png", { type: "image/png" });

    fireEvent.drop(byTestId("product-media-dropzone") as Element, {
      dataTransfer: { files: [file], types: ["Files"] },
    });

    await waitFor(() => {
      expect(byTestId("media-tile-loading")).not.toBeNull();
    });
    expect(onImageUpload).toHaveBeenCalledTimes(1);
    expect(onImageUpload).toHaveBeenCalledWith(file, 0);
  });

  it("skips a non-image file with Saleor's warning", () => {
    const { onImageUpload } = renderCard();
    const pdf = new File(["pdf-bytes"], "manual.pdf", { type: "application/pdf" });
    const input = byTestId<HTMLInputElement>("product-media-file-input");

    fireEvent.change(input as HTMLInputElement, { target: { files: [pdf] } });

    expect(onImageUpload).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({
      status: "warning",
      text: "1 file was skipped (not an image)",
    });
  });

  it("calls the delete handler of a saved tile", () => {
    const { onImageDelete } = renderCard({ media: [savedMedia] });
    const deleteThunk = onImageDelete.mock.results[0]?.value as ReturnType<typeof vi.fn>;

    fireEvent.click(byTestId("product-media-delete") as HTMLButtonElement);

    expect(onImageDelete).toHaveBeenCalledWith("media-1");
    expect(deleteThunk).toHaveBeenCalledTimes(1);
  });

  it("removes the pending tile and revokes its URL when the upload fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onImageUpload = vi.fn(async () => {
      throw new Error("INVALID_FILE_TYPE");
    });
    const { onImagesUploadComplete } = renderCard({ onImageUpload });
    const file = new File(["image-bytes"], "shoe.png", { type: "image/png" });
    const input = byTestId<HTMLInputElement>("product-media-file-input");

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(byTestId("media-tile-loading")).toBeNull();
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pending");
    expect(onImagesUploadComplete).toHaveBeenCalledWith({ successCount: 0, failureCount: 1 });
  });
});
