// Adapted from saleor-dashboard: src/products/views/ProductVariant/ProductVariant.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variant edit page's container: loads the variant and the warehouses, saves it through
// Saleor's composite `VariantUpdate` (stock delete/create/update, then `productVariantUpdate`),
// deletes it through Saleor's dialog (URL `action=remove`) and reports errors. Field errors stay on
// the form; every other error (stock errors included) becomes an error notification. Not yet:
// attributes, media, channel listings, metadata, translations, set-default and reordering.
import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { getMutationStatus } from "../../../categories/mutationStatus";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import {
  type ProductErrorFragment,
  ProductVariantDetailsDocument,
  type ProductVariantStocksDeleteErrorFragment,
  VariantDeleteDocument,
  VariantUpdateDocument,
  type WarehouseFragment,
  WarehouseListDocument,
} from "../../../graphql/types.generated";
import { useNotifier } from "../../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../../NotFound";
import { commonErrorMessages, getProductErrorMessage } from "../../../utils/errors";
import { ProductVariantDeleteDialog } from "../../components/ProductVariantDeleteDialog/ProductVariantDeleteDialog";
import {
  getProductVariantFormErrors,
  getProductVariantUpdateData,
  getStockDiff,
  type ProductVariantFormData,
} from "../../components/ProductVariantPage/form";
import { ProductVariantPage } from "../../components/ProductVariantPage/ProductVariantPage";
import { type ProductVariantUrlDialog, productUrl, productVariantEditUrl } from "../../urls";
import { productVariantPageMessages as messages } from "./messages";

/** `getProductErrorMessage` is typed for ProductErrorCode; the stock delete payload's StockError
 * carries its own StockErrorCode, so the one code it shares with the API's messages is mapped here
 * and the API's message is used otherwise. */
const getStockErrorMessage = (
  error: Pick<ProductVariantStocksDeleteErrorFragment, "code" | "message">,
  intl: IntlShape,
): string =>
  error.code === "GRAPHQL_ERROR"
    ? intl.formatMessage(commonErrorMessages.graphqlError)
    : error.message || intl.formatMessage(commonErrorMessages.unknownError);

export const ProductVariant = () => {
  const { variantId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action") as ProductVariantUrlDialog | null;
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();
  const { resetFormsState } = useExitFormDialog();
  const [errors, setErrors] = useState<ProductErrorFragment[]>([]);
  const [errorsFor, setErrorsFor] = useState(variantId);

  // The previous variant's errors must not leak into the next one (state reset during render,
  // the same pattern as CreateProductDialog; an effect would flash the old errors first).
  if (errorsFor !== variantId) {
    setErrorsFor(variantId);
    setErrors([]);
  }

  const { data, loading } = useQuery(ProductVariantDetailsDocument, {
    variables: { id: variantId },
  });
  const variant = data?.productVariant;
  const productId = variant?.product.id ?? "";

  const { data: warehousesData } = useQuery(WarehouseListDocument);
  const warehouses: WarehouseFragment[] =
    warehousesData?.warehouses?.edges.map((edge) => edge.node) ?? [];

  const [updateVariant, updateResult] = useMutation(VariantUpdateDocument, {
    onCompleted: (result) => {
      const deleteErrors = result.productVariantStocksDelete?.errors ?? [];
      const createErrors = result.productVariantStocksCreate?.errors ?? [];
      const stocksUpdateErrors = result.productVariantStocksUpdate?.errors ?? [];
      const updateErrors = result.productVariantUpdate?.errors ?? [];
      setErrors(updateErrors);

      if (
        deleteErrors.length === 0 &&
        createErrors.length === 0 &&
        stocksUpdateErrors.length === 0 &&
        updateErrors.length === 0
      ) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.savedChanges),
        });

        return;
      }

      for (const error of deleteErrors) {
        notify({
          status: "error",
          text: getStockErrorMessage(error, intl),
        });
      }

      for (const error of [...createErrors, ...stocksUpdateErrors]) {
        notify({
          status: "error",
          text: getProductErrorMessage(error, intl),
        });
      }

      for (const error of getProductVariantFormErrors(updateErrors).other) {
        notify({
          status: "error",
          text: getProductErrorMessage(error, intl),
        });
      }
    },
  });

  const [deleteVariant, deleteResult] = useMutation(VariantDeleteDocument, {
    onCompleted: (result) => {
      const nextErrors = result.productVariantDelete?.errors ?? [];

      if (nextErrors.length > 0) {
        for (const error of nextErrors) {
          notify({
            status: "error",
            text: getProductErrorMessage(error, intl),
          });
        }

        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(messages.variantRemoved),
      });
      // The variant is gone: unsaved edits to it must not block leaving.
      resetFormsState();
      navigate(productUrl(productId));
    },
  });

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = (dialog: ProductVariantUrlDialog) =>
    navigate(productVariantEditUrl(variantId, { action: dialog }));
  const closeModal = () => navigate(productVariantEditUrl(variantId), { replace: true });

  const handleUpdate = async (formData: ProductVariantFormData) => {
    const { addStocks, updateStocks, removeStocks } = getStockDiff(variant, formData.stocks);
    const result = await updateVariant({
      variables: {
        id: variantId,
        input: getProductVariantUpdateData(formData),
        addStocks,
        removeStocks,
        stocks: updateStocks,
      },
    });

    return [
      ...(result.data?.productVariantStocksDelete?.errors ?? []),
      ...(result.data?.productVariantStocksCreate?.errors ?? []),
      ...(result.data?.productVariantStocksUpdate?.errors ?? []),
      ...(result.data?.productVariantUpdate?.errors ?? []),
    ];
  };

  if (!loading && !variant) {
    return <NotFound />;
  }

  return (
    <>
      <ProductVariantPage
        productId={productId}
        variant={variant}
        warehouses={warehouses}
        disabled={loading}
        errors={errors}
        saveButtonBarState={getMutationStatus({ ...updateResult, errors })}
        onSubmit={handleUpdate}
        onDelete={() => openModal("remove")}
      />
      <ProductVariantDeleteDialog
        open={action === "remove"}
        name={variant?.name || variant?.sku || ""}
        confirmButtonState={getMutationStatus({
          ...deleteResult,
          errors: deleteResult.data?.productVariantDelete?.errors,
        })}
        onClose={closeModal}
        onConfirm={() => deleteVariant({ variables: { id: variantId } })}
      />
    </>
  );
};
