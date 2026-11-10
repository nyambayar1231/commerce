// Adapted from saleor-dashboard: src/products/views/ProductUpdate/ProductUpdate.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The update page's container: loads the product, saves it through `productUpdate`, deletes it
// through Saleor's dialog (URL `action=remove`) and reports errors. Field errors stay on the form;
// anything without an input (or a null field) becomes an error notification. Not yet: media,
// attributes, variants, channel listings, metadata, translations and extensions.
import { useMutation, useQuery } from "@apollo/client";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { getMutationStatus } from "../../../categories/mutationStatus";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import {
  ProductDeleteDocument,
  ProductDetailsDocument,
  ProductUpdateDocument,
} from "../../../graphql/types.generated";
import { useNotifier } from "../../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../../NotFound";
import { getProductErrorMessage } from "../../../utils/errors";
import { ProductDeleteDialog } from "../../components/ProductDeleteDialog/ProductDeleteDialog";
import {
  getProductUpdateFormErrors,
  type ProductUpdateData,
} from "../../components/ProductUpdatePage/form";
import { ProductUpdatePage } from "../../components/ProductUpdatePage/ProductUpdatePage";
import { type ProductUrlDialog, productListUrl, productUrl } from "../../urls";
import { productUpdatePageMessages as messages } from "./messages";

export const ProductUpdate = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action") as ProductUrlDialog | null;
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();
  const { resetFormsState } = useExitFormDialog();

  const { data, loading } = useQuery(ProductDetailsDocument, { variables: { id } });
  const product = data?.product;

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

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = (dialog: ProductUrlDialog) => navigate(productUrl(id, { action: dialog }));
  const closeModal = () => navigate(productUrl(id), { replace: true });

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
    </>
  );
};
