// Adapted from saleor-dashboard: src/products/views/ProductVariantCreate.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variant create page's container: loads the product and its variants, creates the variant
// through `productVariantCreate`, then notifies and navigates to the new variant's page. Field
// errors stay on the form; anything without an input becomes an error notification. Not yet:
// attributes, media, channel listings, stocks, metadata and warehouse search.
import { useMutation, useQuery } from "@apollo/client";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router";

import { getMutationStatus } from "../../../categories/mutationStatus";
import {
  ProductVariantCreateDataDocument,
  VariantCreateDocument,
} from "../../../graphql/types.generated";
import { useNotifier } from "../../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../../NotFound";
import { getProductErrorMessage } from "../../../utils/errors";
import { ProductVariantCreatePage } from "../../components/ProductVariantCreatePage/ProductVariantCreatePage";
import {
  getProductVariantCreateData,
  getProductVariantFormErrors,
  type ProductVariantFormData,
} from "../../components/ProductVariantPage/form";
import { productVariantEditUrl } from "../../urls";
import { variantCreateMessages as messages } from "./messages";

export const ProductVariantCreate = () => {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();

  const { data, loading } = useQuery(ProductVariantCreateDataDocument, {
    variables: { id: productId },
  });
  const product = data?.product;

  const [createVariant, createResult] = useMutation(VariantCreateDocument, {
    onCompleted: (result) => {
      const errors = result.productVariantCreate?.errors ?? [];

      if (errors.length > 0) {
        for (const error of getProductVariantFormErrors(errors).other) {
          notify({
            status: "error",
            text: getProductErrorMessage(error, intl),
          });
        }

        return;
      }

      const variantId = result.productVariantCreate?.productVariant?.id;

      if (!variantId) {
        notify({
          status: "error",
          text: intl.formatMessage(messages.variantCreatedError),
        });

        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(messages.variantCreatedSuccess),
      });
      navigate(productVariantEditUrl(variantId));
    },
  });

  const handleCreate = async (formData: ProductVariantFormData) => {
    const result = await createVariant({
      variables: { input: getProductVariantCreateData(productId, formData) },
    });

    return result.data?.productVariantCreate?.errors ?? [];
  };

  if (!loading && !product) {
    return <NotFound />;
  }

  return (
    <ProductVariantCreatePage
      productId={productId}
      product={product}
      disabled={loading || createResult.loading}
      errors={createResult.data?.productVariantCreate?.errors ?? []}
      saveButtonBarState={getMutationStatus({
        ...createResult,
        errors: createResult.data?.productVariantCreate?.errors,
      })}
      onSubmit={handleCreate}
    />
  );
};
