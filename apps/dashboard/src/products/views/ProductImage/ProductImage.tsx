// Adapted from saleor-dashboard: src/products/views/ProductImage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The image detail page's container: loads the product and the image open in the URL, saves its
// alt text through `productMediaUpdate` (Saleor's "Image updated" notification) and deletes it
// through our ProductMediaDeleteDialog (URL `action=remove`), then returns to the product. A
// product that is gone, or an image that is not part of it, is a NotFound page. Not yet: the
// metadata dialog, the translations button and the video branch.
import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import type { IntlShape } from "react-intl";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { getMutationStatus } from "../../../categories/mutationStatus";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import {
  ProductMediaByIdDocument,
  ProductMediaDeleteDocument,
  ProductMediaUpdateDocument,
} from "../../../graphql/types.generated";
import type { UseNotifierResult } from "../../../hooks/useNotifier/useNotifier";
import { useNotifier } from "../../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../../NotFound";
import { getProductErrorMessage } from "../../../utils/errors";
import { ProductMediaDeleteDialog } from "../../components/ProductMediaDeleteDialog/ProductMediaDeleteDialog";
import { productMediaPageMessages } from "../../components/ProductMediaPage/messages";
import { ProductMediaPage } from "../../components/ProductMediaPage/ProductMediaPage";
import { type ProductImageUrlDialog, productImageUrl, productUrl } from "../../urls";
import { mediaDeleteSuccessMessage } from "../ProductUpdate/messages";

export interface ProductMediaUpdateFormData {
  alt: string;
}

/** Saleor's handleUpdate: the form's alt text becomes `productMediaUpdate`'s variables. */
export const getProductMediaUpdateVariables = (
  id: string,
  data: ProductMediaUpdateFormData,
): { id: string; alt: string } => ({ id, alt: data.alt });

export const ProductImage = () => {
  const { productId = "", imageId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action") as ProductImageUrlDialog | null;
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();
  const [errors, setErrors] = useState<ProductErrorFragment[]>([]);
  const [errorsFor, setErrorsFor] = useState(imageId);

  // The previous image's errors must not leak into the next one (reset during render, as the
  // variant page does; an effect would flash the old error first).
  if (errorsFor !== imageId) {
    setErrorsFor(imageId);
    setErrors([]);
  }

  const { data, loading } = useQuery(ProductMediaByIdDocument, {
    variables: { productId, mediaId: imageId },
  });
  const product = data?.product;
  const mediaObj = product?.mainImage;

  const [updateMedia, updateResult] = useMutation(ProductMediaUpdateDocument, {
    onCompleted: (result) => {
      const nextErrors = result.productMediaUpdate?.errors ?? [];

      setErrors(nextErrors);

      if (nextErrors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(productMediaPageMessages.imageUpdated),
        });
      }
    },
  });

  const [deleteMedia, deleteResult] = useMutation(ProductMediaDeleteDocument, {
    onCompleted: (result) => {
      const errors = result.productMediaDelete?.errors ?? [];

      if (errors.length > 0) {
        reportErrors(notify, intl, errors);

        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(mediaDeleteSuccessMessage, { counter: 1 }),
      });
      navigate(productUrl(productId));
    },
  });

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openRemoveDialog = () =>
    navigate(productImageUrl(productId, imageId, { action: "remove" }));
  const closeDialog = () => navigate(productImageUrl(productId, imageId), { replace: true });

  const handleSubmit = (formData: ProductMediaUpdateFormData) => {
    void updateMedia({ variables: getProductMediaUpdateVariables(imageId, formData) });
  };

  if (!loading && (!product || !mediaObj)) {
    return <NotFound />;
  }

  return (
    <>
      <ProductMediaPage
        key={imageId}
        productId={productId}
        productName={product?.name}
        media={product?.media}
        mediaObj={mediaObj ?? undefined}
        errors={errors}
        disabled={loading}
        saveButtonBarState={getMutationStatus({ ...updateResult, errors })}
        onDelete={openRemoveDialog}
        onRowClick={(id) => () => navigate(productImageUrl(productId, id))}
        onSubmit={handleSubmit}
      />
      <ProductMediaDeleteDialog
        open={action === "remove"}
        confirmButtonState={getMutationStatus({
          ...deleteResult,
          errors: deleteResult.data?.productMediaDelete?.errors,
        })}
        onClose={closeDialog}
        onConfirm={() => void deleteMedia({ variables: { id: imageId } })}
      />
    </>
  );
};

function reportErrors(
  notify: UseNotifierResult,
  intl: IntlShape,
  errors: ReadonlyArray<ProductErrorFragment>,
) {
  for (const error of errors) {
    notify({
      status: "error",
      text: getProductErrorMessage(error, intl),
    });
  }
}
