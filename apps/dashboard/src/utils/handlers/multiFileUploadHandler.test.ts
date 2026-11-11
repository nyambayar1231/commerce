import { afterEach, describe, expect, it, vi } from "vitest";

import createMultiFileUploadHandler from "./multiFileUploadHandler";

const files = Array.from({ length: 5 }, (_, index) => new File([`${index}`], `image-${index}.png`));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("multiFileUploadHandler", () => {
  it("keeps at most `concurrency` uploads in flight", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const upload = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
    };

    await createMultiFileUploadHandler(upload, { concurrency: 3 })(files);

    expect(maxInFlight).toBe(3);
  });

  it("reports per-file results and completes once", async () => {
    const failing = files[1] as File;
    const upload = async (file: File) => {
      if (file === failing) {
        throw new Error("network");
      }

      return file.name;
    };
    const onAfterUpload = vi.fn();
    const onError = vi.fn();
    const onCompleted = vi.fn();

    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await createMultiFileUploadHandler(upload, {
      concurrency: 2,
      onAfterUpload,
      onError,
      onCompleted,
    })(files);

    expect(onAfterUpload).toHaveBeenCalledTimes(4);
    expect(onAfterUpload).toHaveBeenCalledWith(0, files, "image-0.png");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(1, files);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledWith(files);
  });

  it("uploads sequentially by default", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const upload = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
    };

    await createMultiFileUploadHandler(upload)(files);

    expect(maxInFlight).toBe(1);
  });
});
