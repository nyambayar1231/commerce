// Adapted from saleor-dashboard: src/utils/handlers/multiFileUploadHandler.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Uploads a list of files with a bounded number in flight. The callbacks report per-file success
// and failure; `onCompleted` runs after every worker is done, so the caller can notify once.

export type CreateMultiFileUploadHandlerCallbacks<T> = Partial<{
  onAfterUpload: (index: number, files: File[], result: T) => void;
  onCompleted: (files: File[]) => void;
  onError: (index: number, files: File[]) => void;
  /** Max number of uploads in flight at once. Defaults to 1 (sequential). */
  concurrency: number;
}>;

async function uploadWithConcurrency<T>(
  files: File[],
  concurrency: number,
  upload: (file: File, fileIndex: number) => Promise<T>,
  {
    onAfterUpload,
    onError,
  }: Pick<CreateMultiFileUploadHandlerCallbacks<T>, "onAfterUpload" | "onError">,
): Promise<void> {
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < files.length) {
      const fileIndex = nextIndex;

      nextIndex += 1;

      try {
        const result = await upload(files[fileIndex] as File, fileIndex);

        onAfterUpload?.(fileIndex, files, result);
      } catch (exception) {
        console.error(`Could not upload file #${fileIndex + 1}. Reason: ${exception}`);
        onError?.(fileIndex, files);
      }
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, files.length));

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

function createMultiFileUploadHandler<T>(
  upload: (file: File, fileIndex: number) => Promise<T>,
  {
    onAfterUpload,
    onCompleted,
    onError,
    concurrency = 1,
  }: CreateMultiFileUploadHandlerCallbacks<T> = {},
) {
  return async (files: FileList | File[]): Promise<void> => {
    const fileArray = Array.from(files);

    await uploadWithConcurrency(fileArray, concurrency, upload, {
      onAfterUpload,
      onError,
    });

    onCompleted?.(fileArray);
  };
}

export default createMultiFileUploadHandler;
