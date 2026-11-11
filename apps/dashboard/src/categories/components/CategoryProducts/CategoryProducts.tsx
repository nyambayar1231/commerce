// Adapted from saleor-dashboard: src/categories/components/CategoryProducts/CategoryProducts.tsx,
// src/collections/components/CollectionProducts/ProductsTable.tsx,
// src/collections/components/CollectionProducts/ProductTableItem.tsx and
// src/components/ChannelsAvailabilityDropdown/ProductChannelsAvailability.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The detail page's "Products in <category>" card: a read-only list of the category's products with
// their thumbnail and single-channel availability, an empty state, and local pagination (as the
// Subcategories card). Left out: assigning/unassigning products (owner, 2026-11-11: a product's
// category is set on its page), the product type column, row selection, and the availability
// tooltip (we show one channel, so the label alone is enough).
import { useQuery } from "@apollo/client";
import { Box, Text, useTheme } from "@saleor/macaw-ui";
import { Image, Tag } from "lucide-react";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import { Placeholder } from "../../../components/Placeholder/Placeholder";
import { TablePagination } from "../../../components/TablePagination/TablePagination";
import {
  type CategoryDetailsFragment,
  CategoryProductsDocument,
} from "../../../graphql/types.generated";
import useListSettings from "../../../hooks/useListSettings";
import { type PaginationState, usePaginator } from "../../../hooks/usePaginator";
import { getProductAvailability } from "./availability";
import { messages, titleMessage } from "./messages";

// Saleor's productUrl (src/products/urls.ts); the product page is M2.4, so this links to the
// section placeholder until then.
const productPath = (id: string): string => `/products/${encodeURIComponent(id)}`;

// Saleor's EmptyImage (src/components/EmptyImage/index.tsx): shown for a product without media.
const EmptyImage = () => (
  <Box
    __width="31px"
    __height="31px"
    display="flex"
    alignItems="center"
    justifyContent="center"
    borderRadius={3}
    borderColor="default1"
    borderStyle="solid"
    borderWidth={1}
    color="default2"
    flexShrink="0"
    data-test-id="empty-image"
  >
    <Image size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} aria-hidden />
  </Box>
);

interface ProductThumbnailProps {
  product: { name: string; thumbnail: { url: string } | null };
}

// Saleor's ProductTableItem thumbnail (src/collections/components/CollectionProducts/
// ProductTableItem.tsx): a bordered 31×31 image with the product name as its alt, or the
// empty-image placeholder when the product has no media.
const ProductThumbnail = ({ product }: ProductThumbnailProps) => (
  <Box flexShrink="0">
    {product.thumbnail ? (
      <Box
        borderColor="default1"
        borderWidth={1}
        borderRadius={3}
        borderStyle="solid"
        overflow="hidden"
      >
        <Box
          as="img"
          src={product.thumbnail.url}
          alt={product.name}
          __width="31px"
          __height="31px"
        />
      </Box>
    ) : (
      <EmptyImage />
    )}
  </Box>
);

interface ProductAvailabilityLabelProps {
  product: { isPublished: boolean; publishedAt: unknown };
}

// Saleor's ProductAvailabilityStatusLabel with the single-channel summary: green "Published" or
// warning "Hidden". Saleor's success dot is the same hard-coded green as getDotColor's.
const ProductAvailabilityLabel = ({ product }: ProductAvailabilityLabelProps) => {
  const intl = useIntl();
  const { themeValues } = useTheme();
  const availability = getProductAvailability(product, Date.now());
  const isPublished = availability === "published";

  return (
    <Box display="flex" alignItems="center" gap={2} minWidth={0}>
      <Box
        flexShrink="0"
        width={2}
        height={2}
        borderRadius="50%"
        __backgroundColor={
          isPublished ? "hsla(173, 100%, 26%, 1)" : themeValues.colors.background.warning1
        }
      />
      <Text size={2} ellipsis display="block" minWidth={0} __flex="1">
        {intl.formatMessage(isPublished ? messages.published : messages.hidden)}
      </Text>
    </Box>
  );
};

interface CategoryProductsProps {
  category: Pick<CategoryDetailsFragment, "id" | "name"> | null | undefined;
  categoryId: string;
  disabled: boolean;
}

export const CategoryProducts = ({ category, categoryId, disabled }: CategoryProductsProps) => {
  const intl = useIntl();
  const { settings, updateListSettings } = useListSettings("COLLECTION_PRODUCTS_LIST");

  // The card's page lives in state, not in the URL (Saleor's useLocalPaginationState); another
  // category starts again on the first page.
  const [page, setPage] = useState<PaginationState>({});
  const [pageFor, setPageFor] = useState(categoryId);

  if (pageFor !== categoryId) {
    setPageFor(categoryId);
    setPage({});
  }

  const pagination: PaginationState =
    page.before !== undefined
      ? { before: page.before, last: settings.rowNumber }
      : { after: page.after, first: settings.rowNumber };

  const { data, loading } = useQuery(CategoryProductsDocument, {
    variables: {
      id: categoryId,
      first: pagination.first,
      after: pagination.after,
      last: pagination.last,
      before: pagination.before,
    },
    skip: !categoryId,
  });
  const products = data?.category?.products;
  const rows = products?.edges.map((edge) => edge.node) ?? [];
  const paginator = usePaginator({
    pageInfo: products?.pageInfo,
    paginationState: pagination,
    queryString: {},
  });

  return (
    <DetailSettingsCard
      contentFlush
      title={intl.formatMessage(titleMessage, { categoryName: category?.name ?? "…" })}
      data-test-id="category-products"
    >
      {rows.length > 0 ? (
        <>
          <Box
            display="flex"
            alignItems="center"
            gap={3}
            paddingX={4}
            paddingY={2}
            backgroundColor="default2"
            borderBottomStyle="solid"
            borderColor="default1"
            borderBottomWidth={1}
          >
            <Box flexGrow="1" minWidth={0}>
              <Text size={2} color="default2">
                <FormattedMessage {...messages.name} />
              </Text>
            </Box>
            <Box __width="160px" flexShrink="0">
              <Text size={2} color="default2">
                <FormattedMessage {...messages.availability} />
              </Text>
            </Box>
          </Box>
          {rows.map((product, index) => (
            <Link
              key={product.id}
              to={productPath(product.id)}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <Box
                display="flex"
                alignItems="center"
                gap={3}
                paddingX={4}
                paddingY={2}
                backgroundColor={{ hover: "default1Hovered" }}
                borderBottomStyle="solid"
                borderColor="default1"
                borderBottomWidth={index === rows.length - 1 ? 0 : 1}
                data-test-id="category-product-row"
              >
                <Box display="flex" alignItems="center" gap={3} flexGrow="1" minWidth={0}>
                  <ProductThumbnail product={product} />
                  <Text size={2} ellipsis display="block">
                    {product.name}
                  </Text>
                </Box>
                <Box __width="160px" flexShrink="0">
                  <ProductAvailabilityLabel product={product} />
                </Box>
              </Box>
            </Link>
          ))}
          <Box
            paddingX={4}
            paddingY={3}
            borderTopStyle="solid"
            borderColor="default1"
            borderTopWidth={1}
          >
            <TablePagination
              settings={settings}
              onUpdateListSettings={(key, value) => {
                updateListSettings(key, value);
                setPage({});
              }}
              disabled={disabled}
              hasNextPage={paginator.hasNextPage}
              hasPreviousPage={paginator.hasPreviousPage}
              onNextPage={() => setPage({ after: products?.pageInfo.endCursor ?? undefined })}
              onPreviousPage={() =>
                setPage({ before: products?.pageInfo.startCursor ?? undefined })
              }
            />
          </Box>
        </>
      ) : !loading ? (
        <Box padding={4}>
          <Placeholder
            icon={
              <Box color="default2" display="flex" aria-hidden>
                <Tag size={iconSize.large} strokeWidth={iconStrokeWidthBySize.large} />
              </Box>
            }
          >
            <FormattedMessage {...messages.empty} />
          </Placeholder>
        </Box>
      ) : null}
    </DetailSettingsCard>
  );
};

CategoryProducts.displayName = "CategoryProducts";
