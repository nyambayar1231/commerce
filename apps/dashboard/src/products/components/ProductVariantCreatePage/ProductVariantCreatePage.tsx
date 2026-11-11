// Adapted from saleor-dashboard: src/products/components/ProductVariantCreatePage/ProductVariantCreatePage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's layout for the variant create page: TopNav ("New variant") with a link back to the
// product, the existing variants on the left, Variant Name / Pricing / Inventory (with its
// per-warehouse stock table) in the main column, and the Savebar (Back, Save). No Delete: the
// variant does not exist yet. Not yet: attributes, media, channels, shipping/weight, checkout
// settings and metadata.
import { Box } from "@saleor/macaw-ui";
import { Tag } from "lucide-react";
import { useMemo } from "react";
import { defineMessages, useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { TopNav } from "../../../components/AppLayout/TopNav";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { DetailPageContent } from "../../../components/DetailPageContent/DetailPageContent";
import { topNavLucideIconProps } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import type {
  ProductErrorFragment,
  ProductVariantCreateDataQuery,
  WarehouseFragment,
} from "../../../graphql/types.generated";
import { productUrl } from "../../urls";
import { ProductStocks } from "../ProductStocks/ProductStocks";
import { ProductVariantName } from "../ProductVariantName/ProductVariantName";
import { ProductVariantNavigation } from "../ProductVariantNavigation/ProductVariantNavigation";
import {
  getProductVariantFormData,
  type ProductVariantFormData,
  useProductVariantForm,
} from "../ProductVariantPage/form";
import { messages as destinationMessages } from "../ProductVariantPage/messages";
import { ProductVariantPrice } from "../ProductVariantPrice/ProductVariantPrice";

const messages = defineMessages({
  newVariant: {
    id: "IqRBql",
    defaultMessage: "New variant",
    description: "variant name",
  },
});

interface ProductVariantCreatePageProps {
  productId: string;
  product: ProductVariantCreateDataQuery["product"] | undefined | null;
  /** The warehouses the Inventory card's Assign Warehouses dialog lists. */
  warehouses: WarehouseFragment[];
  errors: ProductErrorFragment[];
  disabled: boolean;
  saveButtonBarState: ConfirmButtonTransitionState;
  onSubmit: (data: ProductVariantFormData) => Promise<unknown[]>;
}

export const ProductVariantCreatePage = ({
  productId,
  product,
  warehouses,
  errors,
  disabled,
  saveButtonBarState,
  onSubmit,
}: ProductVariantCreatePageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  // The create form always starts empty; entering a value is the first unsaved change.
  const initial = useMemo(() => getProductVariantFormData(null), []);
  const {
    data,
    change,
    changeTrackInventory,
    changeStock,
    addStock,
    removeStock,
    submit,
    isSaveDisabled,
  } = useProductVariantForm(initial, onSubmit, disabled, false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DetailPageLayout gridTemplateColumns={1}>
        <TopNav
          href={productUrl(productId)}
          hrefIcon={<Tag {...topNavLucideIconProps} />}
          hrefTitle={intl.formatMessage(destinationMessages.product)}
          title={intl.formatMessage(messages.newVariant)}
        />
        <DetailPageLayout.Content>
          <DetailPageContent>
            {/* Saleor's Grid "inverted": the variants navigation next to the form. */}
            <Box display="grid" __gridTemplateColumns="4fr 9fr" gap={4} alignItems="start">
              <ProductVariantNavigation
                productId={productId}
                isCreate
                variants={product?.variants ?? []}
              />
              <Box display="flex" flexDirection="column" gap={4}>
                <ProductVariantName
                  value={data.name}
                  disabled={disabled}
                  errors={errors}
                  onChange={change}
                />
                <ProductVariantPrice
                  value={data.price}
                  currency="MNT"
                  disabled={disabled}
                  errors={errors}
                  onChange={change}
                />
                <ProductStocks
                  data={{ sku: data.sku, trackInventory: data.trackInventory }}
                  stocks={data.stocks}
                  warehouses={warehouses}
                  disabled={disabled}
                  errors={errors}
                  onChange={change}
                  onTrackInventoryChange={changeTrackInventory}
                  onStockChange={changeStock}
                  onStockAdd={addStock}
                  onStockDelete={removeStock}
                />
              </Box>
            </Box>
          </DetailPageContent>
        </DetailPageLayout.Content>
        <Savebar>
          <Savebar.Spacer />
          <Savebar.CancelButton onClick={() => navigate(productUrl(productId))} />
          <Savebar.ConfirmButton
            transitionState={saveButtonBarState}
            onClick={() => void submit()}
            disabled={isSaveDisabled}
          />
        </Savebar>
      </DetailPageLayout>
    </form>
  );
};

ProductVariantCreatePage.displayName = "ProductVariantCreatePage";
