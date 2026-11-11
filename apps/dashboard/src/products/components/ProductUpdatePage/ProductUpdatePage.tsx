// Adapted from saleor-dashboard: src/products/components/ProductUpdatePage/ProductUpdatePage.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's layout for the product update page: TopNav (all products, the ⋯ menu with Delete
// product), General Information, the Media card and the read-only Variants card in the main
// column, Organize Product and Availability in the right sidebar, and the Savebar (save-composition
// hint, Back, Save). Not yet: attributes, variant editing/creation (the variants grid is
// read-only), SEO/slug editing, product type, collections, taxes, metadata, translations, GraphiQL,
// extension widgets and the availability diagnostics.
import type { FetchResult } from "@apollo/client";
import { Box } from "@saleor/macaw-ui";
import { Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { TopNav } from "../../../components/AppLayout/TopNav";
import type { TopNavMenuItem } from "../../../components/AppLayout/TopNav/Menu";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { DetailPageContent } from "../../../components/DetailPageContent/DetailPageContent";
import { iconSize, iconStrokeWidthBySize, topNavLucideIconProps } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import type {
  ProductDetailsFragment,
  ProductErrorFragment,
  ProductMediaCreateMutation,
} from "../../../graphql/types.generated";
import {
  productImageUrl,
  productListPath,
  productVariantAddUrl,
  productVariantEditUrl,
} from "../../urls";
import { ProductAvailabilityCard } from "../ProductAvailabilityCard/ProductAvailabilityCard";
import { ProductDetailsForm } from "../ProductDetailsForm/ProductDetailsForm";
import { type ImagesUploadCompleteResult, ProductMedia } from "../ProductMedia/ProductMedia";
import type { ReorderEvent } from "../ProductMedia/useProductMediaDrag";
import { ProductOrganization } from "../ProductOrganization/ProductOrganization";
import { ProductVariants } from "../ProductVariants/ProductVariants";
import { type ProductUpdateData, useProductUpdateForm } from "./form";
import { messages } from "./messages";
import { ProductSaveCompositionHint } from "./ProductSaveCompositionHint";

interface ProductUpdatePageProps {
  product: ProductDetailsFragment | undefined | null;
  errors: ProductErrorFragment[];
  disabled: boolean;
  saveButtonBarState: ConfirmButtonTransitionState;
  onSubmit: (data: ProductUpdateData) => Promise<unknown[]>;
  onDelete: () => void;
  onImageUpload: (file: File) => Promise<FetchResult<ProductMediaCreateMutation>>;
  onImagesUploadComplete: (result: ImagesUploadCompleteResult) => void;
  onImageDelete: (id: string) => () => void;
  onImageReorder: (event: ReorderEvent) => void;
}

export const ProductUpdatePage = ({
  product,
  errors,
  disabled,
  saveButtonBarState,
  onSubmit,
  onDelete,
  onImageUpload,
  onImagesUploadComplete,
  onImageDelete,
  onImageReorder,
}: ProductUpdatePageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const {
    data,
    change,
    changeCategory,
    changeIsPublished,
    submit,
    isSaveDisabled,
    saveComposition,
  } = useProductUpdateForm(product, onSubmit, disabled);

  // The selected category's label lives next to the form (the form stores only the global ID).
  const [categoryName, setCategoryName] = useState(product?.category?.name ?? "");

  useEffect(() => {
    setCategoryName(product?.category?.name ?? "");
  }, [product?.category?.name]);

  const handleCategoryChange = (category: string | null, name: string) => {
    changeCategory(category);
    setCategoryName(name);
  };

  const menuItems = useMemo((): TopNavMenuItem[] => {
    if (!product?.id) {
      return [];
    }

    return [
      {
        label: intl.formatMessage(messages.deleteProduct),
        onSelect: onDelete,
        testId: "delete-product",
        color: "critical1",
        icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
      },
    ];
  }, [intl, onDelete, product?.id]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DetailPageLayout>
        <TopNav
          href={productListPath}
          hrefIcon={<Tag {...topNavLucideIconProps} />}
          hrefTitle={intl.formatMessage(messages.allProducts)}
          title={product?.name ?? "..."}
          actionsGap={3}
        >
          {menuItems.length > 0 && (
            <TopNav.Menu
              items={
                disabled || !product
                  ? menuItems.map((item) => ({ ...item, disabled: true }))
                  : menuItems
              }
              dataTestId="menu"
            />
          )}
        </TopNav>
        <DetailPageLayout.Content>
          <DetailPageContent>
            <ProductDetailsForm data={data} disabled={disabled} errors={errors} onChange={change} />
            <ProductMedia
              media={product?.media}
              onImageUpload={onImageUpload}
              onImagesUploadComplete={onImagesUploadComplete}
              onImageDelete={onImageDelete}
              getImageEditHref={
                product ? (mediaId) => productImageUrl(product.id, mediaId) : undefined
              }
              onImageReorder={onImageReorder}
            />
            {product ? (
              <ProductVariants
                variants={product.variants}
                onAddVariant={() => navigate(productVariantAddUrl(product.id))}
                onRowClick={(variantId) => navigate(productVariantEditUrl(variantId))}
              />
            ) : null}
          </DetailPageContent>
        </DetailPageLayout.Content>
        <DetailPageLayout.RightSidebar paddingTop={6}>
          <Box display="flex" flexDirection="column" gap={4} paddingX={6}>
            <ProductOrganization
              category={data.category}
              categoryName={categoryName}
              disabled={disabled}
              errors={errors}
              onCategoryChange={handleCategoryChange}
            />
            <ProductAvailabilityCard
              isPublished={data.isPublished}
              publishedAt={product?.publishedAt}
              disabled={disabled}
              errors={errors}
              onChange={changeIsPublished}
            />
          </Box>
        </DetailPageLayout.RightSidebar>
        <Savebar>
          <Savebar.Spacer />
          <ProductSaveCompositionHint composition={saveComposition} />
          <Savebar.CancelButton onClick={() => navigate(productListPath)} />
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

ProductUpdatePage.displayName = "ProductUpdatePage";
