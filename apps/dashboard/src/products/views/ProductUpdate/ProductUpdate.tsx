// Adapted from saleor-dashboard: src/products/views/ProductUpdate/ProductUpdate.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The update page's container: loads the product, saves it through `productUpdate`, deletes it
// through Saleor's dialog (URL `action=remove`) and reports errors. Field errors stay on the form;
// anything without an input (or a null field) becomes an error notification. The media handlers
// follow Saleor's src/products/views/ProductUpdate/handlers: one upload per file (concurrency is
// in the card), batch completion notifications, an optimistic reorder and the `remove-media`
// dialog. Not yet: attributes, variant editing, channel listings, metadata, translations and
// extensions.
import {
  type FetchResult,
  type MutationFunctionOptions,
  useMutation,
  useQuery,
} from "@apollo/client";
import { arrayMove } from "@dnd-kit/sortable";
import type { IntlShape } from "react-intl";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { getMutationStatus } from "../../../categories/mutationStatus";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import type {
  ProductDetailsFragment,
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
} from "../../components/ProductUpdatePage/form";
import { ProductUpdatePage } from "../../components/ProductUpdatePage/ProductUpdatePage";
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

  const { data, loading } = useQuery(ProductDetailsDocument, { variables: { id } });
  const product = data?.product;

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = (dialog: ProductUrlDialog, params?: ProductUrlQueryParams) =>
    navigate(productUrl(id, { ...params, action: dialog }));
  const closeModal = () => navigate(productUrl(id), { replace: true });

  const [updateProduct, updateResult] = useMutation(ProductUpdateDocument, {
    onCompleted: (result) => {
      const errors = result.productUpdate.errors;

      if (errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.savedChanges),
        });

        return;
      }

      for (const error of getProductUpdateFormErrors(errors).other) {
        notify({
          status: "error",
          text: getProductErrorMessage(error, intl),
        });
      }
    },
  });

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

  const handleUpdate = async (formData: ProductUpdateData) => {
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

    return result.data?.productUpdate.errors ?? [];
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
        disabled={loading}
        errors={updateResult.data?.productUpdate.errors ?? []}
        saveButtonBarState={getMutationStatus({
          ...updateResult,
          errors: updateResult.data?.productUpdate.errors,
        })}
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
