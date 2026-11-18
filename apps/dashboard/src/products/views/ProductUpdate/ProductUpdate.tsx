// Adapted from saleor-dashboard: src/products/views/ProductUpdate/ProductUpdate.tsx and
// src/products/views/ProductUpdate/handlers/useProductUpdateHandler.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The update page's container: loads the product, saves it through `productUpdate` and then the
// Variants grid, deletes it through Saleor's dialog (URL `action=remove`) and reports errors. The
// grid is saved one variant at a time in row order, Saleor's order without its bulk mutation:
// `productVariantUpdate` with only the changed fields, then `productVariantStocksUpdate` for the
// changed warehouse cells. A variant whose calls all succeed has its edits cleared (the page does
// it from the result); a rejected one keeps them and its errors map to cells. The "Saved changes"
// toast waits for everything. Field errors stay on the form; anything without an input (or a null
// field) becomes an error notification. The media handlers follow Saleor's
// src/products/views/ProductUpdate/handlers: one upload per file (concurrency is in the card),
// batch completion notifications, an optimistic reorder and the `remove-media` dialog. Not yet:
// attributes, bulk variant mutations, variant creation/removal in the grid, channel listings,
// metadata, translations and extensions.
import {
  type FetchResult,
  type MutationFunctionOptions,
  useMutation,
  useQuery,
} from "@apollo/client";
import { arrayMove } from "@dnd-kit/sortable";
import { useState } from "react";
import type { IntlShape } from "react-intl";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { getMutationStatus } from "../../../categories/mutationStatus";
import type { DatagridChange } from "../../../components/Datagrid/hooks/useDatagridChange";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import type {
  BulkStockErrorFragment,
  ProductDetailsFragment,
  ProductErrorFragment,
  ProductMediaCreateMutation,
  ProductMediaCreateMutationVariables,
  ProductMediaReorderMutation,
  ProductMediaReorderMutationVariables,
} from "../../../graphql/types.generated";
import {
  ProductDeleteDocument,
  ProductDetailsDocument,
  ProductMediaCreateDocument,
  ProductMediaDeleteDocument,
  ProductMediaReorderDocument,
  ProductUpdateDocument,
  VariantGridStocksUpdateDocument,
  VariantGridUpdateDocument,
  WarehouseListDocument,
} from "../../../graphql/types.generated";
import type { UseNotifierResult } from "../../../hooks/useNotifier/useNotifier";
import { useNotifier } from "../../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../../NotFound";
import { getProductErrorMessage } from "../../../utils/errors";
import { ProductDeleteDialog } from "../../components/ProductDeleteDialog/ProductDeleteDialog";
import type { ImagesUploadCompleteResult } from "../../components/ProductMedia/ProductMedia";
import {
  getReorderedMediaIds,
  type ReorderEvent,
} from "../../components/ProductMedia/useProductMediaDrag";
import { ProductMediaDeleteDialog } from "../../components/ProductMediaDeleteDialog/ProductMediaDeleteDialog";
import {
  getProductUpdateFormErrors,
  type ProductUpdateData,
  type ProductUpdateSubmitResult,
} from "../../components/ProductUpdatePage/form";
import { ProductUpdatePage } from "../../components/ProductUpdatePage/ProductUpdatePage";
import {
  getInvalidVariantGridErrors,
  getVariantFieldErrors,
  getVariantGridUpdates,
  getVariantStockErrors,
  type VariantGridError,
} from "../../components/ProductVariants/datagrid";
import {
  type ProductUrlDialog,
  type ProductUrlQueryParams,
  productListUrl,
  productUrl,
} from "../../urls";
import {
  mediaDeleteSuccessMessage,
  mediaUploadAllFailedMessage,
  mediaUploadErrorTitleMessage,
  mediaUploadPartialMessage,
  mediaUploadSuccessCountMessage,
  productUpdatePageMessages as messages,
} from "./messages";

type ProductMediaReorderOptions = Pick<
  MutationFunctionOptions<ProductMediaReorderMutation, ProductMediaReorderMutationVariables>,
  "variables" | "optimisticResponse"
>;

/** Saleor's createImageUploadHandler: one file → one `productMediaCreate`; API errors are shown
 * with the API's message and thrown, so the card drops the pending tile. */
const createImageUploadHandler =
  (
    productId: string,
    createProductImage: (
      variables: ProductMediaCreateMutationVariables,
    ) => Promise<FetchResult<ProductMediaCreateMutation>>,
    notify: UseNotifierResult,
    intl: IntlShape,
  ) =>
  async (file: File) => {
    const result = await createProductImage({ alt: "", image: file, product: productId });
    const errors = result.data?.productMediaCreate.errors ?? [];

    if (errors.length > 0 || !result.data?.productMediaCreate.product) {
      // Ours (Saleor shows only the batch summary): the API's reason, titled with the file's
      // name so the toast queue's type+title dedup doesn't merge it with the summary.
      for (const error of errors) {
        notify({
          status: "error",
          title: file.name,
          text: getProductErrorMessage(error, intl),
        });
      }

      throw new Error("Failed to upload product media");
    }

    return result;
  };

/** Saleor's createImagesUploadCompleteHandler: one toast for the batch. */
const createImagesUploadCompleteHandler =
  (notify: UseNotifierResult, intl: IntlShape) =>
  ({ successCount, failureCount }: ImagesUploadCompleteResult) => {
    if (successCount === 0 && failureCount === 0) {
      return;
    }

    if (failureCount === 0) {
      notify({
        status: "success",
        text: intl.formatMessage(mediaUploadSuccessCountMessage, { count: successCount }),
      });

      return;
    }

    if (successCount === 0) {
      notify({
        status: "error",
        title: intl.formatMessage(mediaUploadErrorTitleMessage),
        text: intl.formatMessage(mediaUploadAllFailedMessage, { count: failureCount }),
      });

      return;
    }

    notify({
      status: "warning",
      text: intl.formatMessage(mediaUploadPartialMessage, {
        success: successCount,
        failed: failureCount,
      }),
    });
  };

/** Saleor's createImageReorderHandler: moved indices → the product's media ids in the new order. */
const createImageReorderHandler = (
  product: ProductDetailsFragment | null | undefined,
  reorderProductImages: (options: ProductMediaReorderOptions) => void,
) => {
  return ({ oldIndex, newIndex }: ReorderEvent) => {
    const media = product?.media;

    if (!product || !media?.length) {
      return;
    }

    const mediaIds = getReorderedMediaIds(
      media.map((item) => item.id),
      { oldIndex, newIndex },
    );

    if (!mediaIds) {
      return;
    }

    reorderProductImages({
      variables: {
        mediaIds,
        productId: product.id,
      },
      optimisticResponse: {
        __typename: "Mutation",
        productMediaReorder: {
          __typename: "ProductMediaReorder",
          errors: [],
          product: {
            __typename: "Product",
            id: product.id,
            media: arrayMove([...media], oldIndex, newIndex),
          },
        },
      },
    });
  };
};

export const ProductUpdate = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action") as ProductUrlDialog | null;
  const mediaIdToDelete = searchParams.get("ids") ?? undefined;
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();
  const { resetFormsState } = useExitFormDialog();
  const [variantErrors, setVariantErrors] = useState<VariantGridError[]>([]);
  // One Save is the product plus one call per changed variant: the bar stays in loading until the
  // last one, so a second click can't start the same writes again.
  const [isSaving, setIsSaving] = useState(false);

  const { data, loading } = useQuery(ProductDetailsDocument, { variables: { id } });
  const product = data?.product;

  // The Variants card's stock columns; one warehouse in this project, no pagination.
  const { data: warehousesData } = useQuery(WarehouseListDocument);
  const warehouses = warehousesData?.warehouses?.edges.map((edge) => edge.node) ?? [];

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = (dialog: ProductUrlDialog, params?: ProductUrlQueryParams) =>
    navigate(productUrl(id, { ...params, action: dialog }));
  const closeModal = () => navigate(productUrl(id), { replace: true });

  const [updateProduct, updateResult] = useMutation(ProductUpdateDocument);

  const [updateVariantGrid] = useMutation(VariantGridUpdateDocument);
  const [updateVariantGridStocks] = useMutation(VariantGridStocksUpdateDocument);

  const [deleteProduct, deleteResult] = useMutation(ProductDeleteDocument, {
    onCompleted: (result) => {
      const errors = result.productDelete.errors;

      if (errors.length > 0) {
        for (const error of errors) {
          notify({
            status: "error",
            text: getProductErrorMessage(error, intl),
          });
        }

        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(messages.productRemoved),
      });
      // The product is gone: unsaved edits to it must not block leaving.
      resetFormsState();
      navigate(productListUrl());
    },
  });

  const [createProductImage] = useMutation(ProductMediaCreateDocument);

  const [deleteProductMedia, deleteMediaResult] = useMutation(ProductMediaDeleteDocument, {
    onCompleted: (result) => {
      const errors = result.productMediaDelete.errors;

      if (errors.length > 0) {
        for (const error of errors) {
          notify({
            status: "error",
            text: getProductErrorMessage(error, intl),
          });
        }

        return;
      }

      closeModal();
      notify({
        status: "success",
        text: intl.formatMessage(mediaDeleteSuccessMessage, { counter: 1 }),
      });
    },
  });

  const [reorderProductImages] = useMutation(ProductMediaReorderDocument, {
    onCompleted: (result) => {
      const errors = result.productMediaReorder.errors;

      if (errors.length > 0) {
        for (const error of errors) {
          notify({
            status: "error",
            text: getProductErrorMessage(error, intl),
          });
        }

        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(messages.mediaReorderSuccess),
      });
    },
  });

  const submitUpdate = async (
    formData: ProductUpdateData,
    variantChanges: DatagridChange[],
  ): Promise<ProductUpdateSubmitResult> => {
    const result = await updateProduct({
      variables: {
        id,
        input: {
          name: formData.name,
          // Saleor sends the description on every save; null clears it.
          description: formData.description ? JSON.stringify(formData.description) : null,
          category: formData.category,
          isPublished: formData.isPublished,
        },
      },
    });
    const errors = result.data?.productUpdate.errors ?? [];

    for (const error of getProductUpdateFormErrors(errors).other) {
      notify({
        status: "error",
        text: getProductErrorMessage(error, intl),
      });
    }

    const variants = product?.variants ?? [];
    // An invalid number is never sent: the cell stays red and its variant waits for a fix.
    const invalidErrors = getInvalidVariantGridErrors(variants, variantChanges);
    const updates = getVariantGridUpdates(variants, variantChanges);
    const variantErrors: VariantGridError[] = [...invalidErrors];
    const savedVariantIds: string[] = [];

    for (const update of updates) {
      let updateErrors: ProductErrorFragment[] = [];

      if (Object.keys(update.input).length > 0) {
        const updateResult = await updateVariantGrid({
          variables: { id: update.id, input: update.input },
        });

        updateErrors = updateResult.data?.productVariantUpdate?.errors ?? [];
      }

      let stockErrors: BulkStockErrorFragment[] = [];

      if (update.stocks.length > 0) {
        const stocksResult = await updateVariantGridStocks({
          variables: { variantId: update.id, stocks: update.stocks },
        });

        stockErrors = stocksResult.data?.productVariantStocksUpdate?.errors ?? [];
      }

      for (const error of [...updateErrors, ...stockErrors]) {
        notify({
          status: "error",
          text: getProductErrorMessage(error, intl),
        });
      }

      if (updateErrors.length === 0 && stockErrors.length === 0) {
        savedVariantIds.push(update.id);

        continue;
      }

      variantErrors.push(
        ...getVariantFieldErrors(update.id, updateErrors),
        ...getVariantStockErrors(update.id, update.stocks, stockErrors),
      );
    }

    if (invalidErrors.length > 0) {
      notify({
        status: "error",
        text: intl.formatMessage(messages.invalidVariantCells),
      });
    }

    if (errors.length === 0 && variantErrors.length === 0) {
      notify({
        status: "success",
        text: intl.formatMessage(messages.savedChanges),
      });
    }

    setVariantErrors(variantErrors);

    return { errors, variantErrors, savedVariantIds };
  };

  /** One Save covers the product and its changed variants: the Savebar stays loading throughout. */
  const handleUpdate = async (
    formData: ProductUpdateData,
    variantChanges: DatagridChange[],
  ): Promise<ProductUpdateSubmitResult> => {
    setIsSaving(true);

    try {
      return await submitUpdate(formData, variantChanges);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = createImageUploadHandler(
    id,
    (variables) => createProductImage({ variables }),
    notify,
    intl,
  );
  const handleImagesUploadComplete = createImagesUploadCompleteHandler(notify, intl);
  const handleImageReorder = createImageReorderHandler(product, (options) => {
    void reorderProductImages(options);
  });
  const handleImageDelete = (mediaId: string) => () => openModal("remove-media", { ids: mediaId });
  const handleConfirmMediaDelete = () => {
    if (!mediaIdToDelete) {
      return;
    }

    void deleteProductMedia({ variables: { id: mediaIdToDelete } });
  };

  if (!loading && !product) {
    return <NotFound />;
  }

  return (
    <>
      <ProductUpdatePage
        product={product}
        warehouses={warehouses}
        disabled={loading}
        errors={updateResult.data?.productUpdate.errors ?? []}
        variantErrors={variantErrors}
        saveButtonBarState={
          isSaving
            ? "loading"
            : getMutationStatus({
                ...updateResult,
                errors: updateResult.data?.productUpdate.errors,
              })
        }
        onSubmit={handleUpdate}
        onDelete={() => openModal("remove")}
        onImageUpload={handleImageUpload}
        onImagesUploadComplete={handleImagesUploadComplete}
        onImageDelete={handleImageDelete}
        onImageReorder={handleImageReorder}
      />
      <ProductDeleteDialog
        open={action === "remove"}
        name={product?.name ?? ""}
        confirmButtonState={getMutationStatus({
          ...deleteResult,
          errors: deleteResult.data?.productDelete.errors,
        })}
        onClose={closeModal}
        onConfirm={() => deleteProduct({ variables: { id } })}
      />
      <ProductMediaDeleteDialog
        open={action === "remove-media" && Boolean(mediaIdToDelete)}
        confirmButtonState={getMutationStatus({
          ...deleteMediaResult,
          errors: deleteMediaResult.data?.productMediaDelete.errors,
        })}
        onClose={closeModal}
        onConfirm={handleConfirmMediaDelete}
      />
    </>
  );
};
