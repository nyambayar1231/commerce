// Adapted from saleor-dashboard: src/products/components/ProductVariantPage/ProductVariantPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's layout for the variant page: TopNav with the variant name and a link back to the product,
// the variants navigation on the left, Variant Name / Pricing / Inventory (with its per-warehouse
// stock table) in the main column, and the Savebar (Delete on the edit page, Back, Save). Not yet:
// attributes, media, channels, shipping/weight, checkout settings, metadata, translations,
// set-default and the sticky navigation.
import { Box } from "@saleor/macaw-ui";
import { Tag } from "lucide-react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { TopNav } from "../../../components/AppLayout/TopNav";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { DetailPageContent } from "../../../components/DetailPageContent/DetailPageContent";
import { topNavLucideIconProps } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import type {
  ProductErrorFragment,
  ProductVariantDetailsFragment,
  WarehouseFragment,
} from "../../../graphql/types.generated";
import { productListPath, productUrl } from "../../urls";
import { ProductStocks } from "../ProductStocks/ProductStocks";
import { ProductVariantName } from "../ProductVariantName/ProductVariantName";
import { ProductVariantNavigation } from "../ProductVariantNavigation/ProductVariantNavigation";
import { ProductVariantPrice } from "../ProductVariantPrice/ProductVariantPrice";
import {
  getProductVariantFormData,
  type ProductVariantFormData,
  useProductVariantForm,
} from "./form";
import { messages } from "./messages";

interface ProductVariantPageProps {
  /** The product the variant belongs to; empty while the variant is loading. */
  productId: string;
  variant: ProductVariantDetailsFragment | undefined | null;
  /** The warehouses the Inventory card's Assign Warehouses dialog lists. */
  warehouses: WarehouseFragment[];
  errors: ProductErrorFragment[];
  disabled: boolean;
  saveButtonBarState: ConfirmButtonTransitionState;
  onSubmit: (data: ProductVariantFormData) => Promise<unknown[]>;
  onDelete: () => void;
}

export const ProductVariantPage = ({
  productId,
  variant,
  warehouses,
  errors,
  disabled,
  saveButtonBarState,
  onSubmit,
  onDelete,
}: ProductVariantPageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const initial = useMemo(() => getProductVariantFormData(variant), [variant]);
  const {
    data,
    change,
    changeTrackInventory,
    changeStock,
    addStock,
    removeStock,
    submit,
    isSaveDisabled,
  } = useProductVariantForm(initial, onSubmit, disabled, true);

  const backHref = productId ? productUrl(productId) : productListPath;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DetailPageLayout gridTemplateColumns={1}>
        <TopNav
          href={backHref}
          hrefIcon={<Tag {...topNavLucideIconProps} />}
          hrefTitle={intl.formatMessage(messages.product)}
          title={variant?.name || variant?.sku || "..."}
          actionsGap={3}
        />
        <DetailPageLayout.Content>
          <DetailPageContent>
            {/* Saleor's Grid "inverted": the variants navigation next to the form. */}
            <Box display="grid" __gridTemplateColumns="4fr 9fr" gap={4} alignItems="start">
              <ProductVariantNavigation
                productId={productId}
                current={variant?.id}
                variants={variant?.product.variants ?? []}
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
                  currency={variant?.price.currency ?? "MNT"}
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
          <Savebar.DeleteButton onClick={onDelete} />
          <Savebar.Spacer />
          <Savebar.CancelButton onClick={() => navigate(backHref)} />
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

ProductVariantPage.displayName = "ProductVariantPage";
