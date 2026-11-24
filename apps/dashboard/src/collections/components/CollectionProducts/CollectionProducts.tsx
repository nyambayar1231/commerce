// Adapted from saleor-dashboard: src/collections/components/CollectionProducts/{CollectionProducts,
// ProductsTable, ProductTableItem}.tsx and src/components/ChannelsAvailabilityDropdown/
// ProductChannelsAvailability.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The detail page's "Products in <collection>" card: a header with Saleor's "Assign product"
// button, the collection's products with their thumbnail, name (a link to the product page) and
// single-channel availability, a checkbox per row with a bulk "Unassign" and each row's unassign
// (trash) button, an empty state and local pagination (as the category page's card). Assign and
// unassign persist immediately (they are not part of the page's Save), then the card refetches.
// Left out: drag-to-reorder (the API has no manual order), the product type column, the availability
// tooltip (one channel, so the label is enough), the channel-based picker filters and Saleor's
// optimistic row removal (the refetch is immediate).
import { useMutation, useQuery } from "@apollo/client";
import { Box, Button, Text, useTheme } from "@saleor/macaw-ui";
import { Image, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link, useNavigate, useSearchParams } from "react-router";

import { getMutationStatus } from "../../../categories/mutationStatus";
import { Checkbox } from "../../../components/Checkbox/Checkbox";
import cardStyles from "../../../components/DetailSettingsCard/DetailSettingsCard.module.css";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import { Placeholder } from "../../../components/Placeholder/Placeholder";
import { TablePagination } from "../../../components/TablePagination/TablePagination";
import {
  CollectionAssignProductDocument,
  type CollectionDetailsFragment,
  CollectionProductsDocument,
  type CollectionProductsQuery,
  UnassignCollectionProductDocument,
} from "../../../graphql/types.generated";
import useListSettings from "../../../hooks/useListSettings";
import { useNotifier } from "../../../hooks/useNotifier/useNotifier";
import { type PaginationState, usePaginator } from "../../../hooks/usePaginator";
import { productPath } from "../../../products/urls";
import { type CollectionUrlDialog, collectionUrl, parseCollectionUrl } from "../../urls";
import { CollectionAssignProductDialog } from "../CollectionAssignProductDialog/CollectionAssignProductDialog";
import { getProductAvailability } from "./availability";
import { messages, selectedCountMessage, titleMessage } from "./messages";
import { UnassignProductsDialog } from "./UnassignProductsDialog";

type Product = NonNullable<
  NonNullable<CollectionProductsQuery["collection"]>["products"]
>["edges"][number]["node"];

interface ProductThumbnailProps {
  product: Product;
}

// Saleor's ProductTableItem thumbnail: a bordered 31×31 image with the product name as its alt, or
// the empty-image placeholder when the product has no media.
const ProductThumbnail = ({ product }: ProductThumbnailProps) =>
  product.thumbnail ? (
    <Box
      borderColor="default1"
      borderWidth={1}
      borderRadius={3}
      borderStyle="solid"
      overflow="hidden"
      flexShrink="0"
    >
      <Box as="img" src={product.thumbnail.url} alt={product.name} __width="31px" __height="31px" />
    </Box>
  ) : (
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

interface ProductAvailabilityLabelProps {
  product: Product;
}

// Saleor's ProductAvailabilityStatusLabel with the single-channel summary: published, scheduled or
// not published, with the dot colors getDotColor uses.
const ProductAvailabilityLabel = ({ product }: ProductAvailabilityLabelProps) => {
  const intl = useIntl();
  const { themeValues } = useTheme();
  const availability = getProductAvailability(product, Date.now());
  const color = {
    published: "hsla(173, 100%, 26%, 1)",
    scheduled: themeValues.colors.background.warning1,
    "not-published": themeValues.colors.background.critical2,
  }[availability];

  return (
    <Box display="flex" alignItems="center" gap={2} minWidth={0}>
      <Box flexShrink="0" width={2} height={2} borderRadius="50%" __backgroundColor={color} />
      <Text size={2} ellipsis display="block" minWidth={0} __flex="1">
        {intl.formatMessage(
          {
            published: messages.published,
            scheduled: messages.scheduled,
            "not-published": messages.notPublished,
          }[availability],
        )}
      </Text>
    </Box>
  );
};

interface CollectionProductsProps {
  collection: Pick<CollectionDetailsFragment, "id" | "name"> | null | undefined;
  collectionId: string;
  disabled: boolean;
}

export const CollectionProducts = ({
  collection,
  collectionId,
  disabled,
}: CollectionProductsProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseCollectionUrl(searchParams), [searchParams]);
  const notify = useNotifier();
  const { settings, updateListSettings } = useListSettings("COLLECTION_PRODUCTS_LIST");

  // The card's page lives in state, not in the URL (Saleor's useLocalPaginationState); another
  // collection starts again on the first page.
  const [page, setPage] = useState<PaginationState>({});
  const [pageFor, setPageFor] = useState(collectionId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (pageFor !== collectionId) {
    setPageFor(collectionId);
    setPage({});
    setSelectedIds([]);
  }

  const pagination: PaginationState =
    page.before !== undefined
      ? { before: page.before, last: settings.rowNumber }
      : { after: page.after, first: settings.rowNumber };

  const { data, loading, refetch } = useQuery(CollectionProductsDocument, {
    variables: {
      id: collectionId,
      first: pagination.first,
      after: pagination.after,
      last: pagination.last,
      before: pagination.before,
    },
    skip: !collectionId,
  });
  const products = data?.collection?.products;
  const rows = useMemo(() => (products?.edges ?? []).map((edge) => edge.node), [products?.edges]);
  const paginator = usePaginator({
    pageInfo: products?.pageInfo,
    paginationState: pagination,
    queryString: {},
  });

  // Saleor's createDialogActionHandlers: the open dialog (and the rows it acts on) live in the URL.
  const openModal = (dialog: CollectionUrlDialog, ids?: string[]) =>
    navigate(collectionUrl(collectionId, { action: dialog, ids }));
  const closeModal = () => navigate(collectionUrl(collectionId), { replace: true });

  const [assignProduct, assignResult] = useMutation(CollectionAssignProductDocument, {
    onCompleted: (result) => {
      if (result.collectionAddProducts.errors.length > 0) {
        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(messages.productAdded),
      });
      closeModal();
      void refetch();
    },
  });

  const [unassignProduct, unassignResult] = useMutation(UnassignCollectionProductDocument, {
    onCompleted: (result) => {
      if (result.collectionRemoveProducts.errors.length > 0) {
        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(messages.productRemoved),
      });

      if (params.action === "unassign") {
        closeModal();
      }

      setSelectedIds([]);
      // Back to the card's first page, fetched fresh: a cursor into the page we just changed can
      // point at a removed row.
      setPage({});
      void refetch({
        id: collectionId,
        first: settings.rowNumber,
        after: undefined,
        last: undefined,
        before: undefined,
      });
    },
  });

  const changePage = (state: PaginationState) => {
    setSelectedIds([]);
    setPage(state);
  };

  const toggleRow = (productId: string) =>
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : rows.map((row) => row.id));

  const openAssignDialog = () => {
    assignResult.reset();
    openModal("assign");
  };
  const openUnassignDialog = () => {
    unassignResult.reset();
    openModal("unassign", selectedIds);
  };
  const handleUnassign = (productIds: string[]) => {
    if (productIds.length === 0) {
      closeModal();

      return;
    }

    unassignResult.reset();
    void unassignProduct({ variables: { collectionId, products: productIds } });
  };

  return (
    <>
      <Box className={cardStyles.card} data-test-id="collection-products">
        <Box className={[cardStyles.header, cardStyles.headerWithEnd].join(" ")}>
          <Box className={cardStyles.headerMain}>
            <Text size={5} fontWeight="bold" as="h2" className={cardStyles.title}>
              {intl.formatMessage(titleMessage, { name: collection?.name ?? "…" })}
            </Text>
          </Box>
          <Box className={cardStyles.headerEnd}>
            <Button
              data-test-id="assign-product"
              variant="secondary"
              size="small"
              type="button"
              disabled={disabled}
              onClick={openAssignDialog}
            >
              <FormattedMessage {...messages.assignProduct} />
            </Button>
          </Box>
        </Box>

        {rows.length > 0 ? (
          <>
            <Box
              display="flex"
              alignItems="center"
              gap={3}
              paddingX={4}
              backgroundColor="default2"
              borderBottomStyle="solid"
              borderColor="default1"
              borderBottomWidth={1}
            >
              <Box display="flex" alignItems="center" flexShrink="0">
                <Checkbox
                  checked={allSelected}
                  disabled={disabled}
                  aria-label={intl.formatMessage(messages.name)}
                  onChange={toggleAll}
                  data-test-id="select-all-products"
                />
              </Box>
              <Box flexGrow="1" minWidth={0}>
                {selectedIds.length > 0 ? (
                  <Text size={2}>
                    <FormattedMessage
                      {...selectedCountMessage}
                      values={{ number: selectedIds.length }}
                    />
                  </Text>
                ) : (
                  <Text size={2} color="default2">
                    <FormattedMessage {...messages.name} />
                  </Text>
                )}
              </Box>
              {selectedIds.length === 0 && (
                <Box __width="160px" flexShrink="0">
                  <Text size={2} color="default2">
                    <FormattedMessage {...messages.availability} />
                  </Text>
                </Box>
              )}
              <Box __width="112px" flexShrink="0" display="flex" justifyContent="flex-end">
                {selectedIds.length > 0 && (
                  <Button
                    variant="secondary"
                    size="small"
                    type="button"
                    disabled={disabled}
                    onClick={openUnassignDialog}
                    data-test-id="bulk-unassign"
                  >
                    <FormattedMessage {...messages.unassign} />
                  </Button>
                )}
              </Box>
            </Box>
            {rows.map((product, index) => (
              <Box
                key={product.id}
                display="flex"
                alignItems="center"
                gap={3}
                paddingX={4}
                borderBottomStyle="solid"
                borderColor="default1"
                borderBottomWidth={index === rows.length - 1 ? 0 : 1}
                data-test-id="collection-product-row"
              >
                <Box display="flex" alignItems="center" flexShrink="0">
                  <Checkbox
                    checked={selectedIds.includes(product.id)}
                    disabled={disabled}
                    aria-label={product.name}
                    onChange={() => toggleRow(product.id)}
                  />
                </Box>
                <Box flexGrow="1" minWidth={0}>
                  <Link
                    to={productPath(product.id)}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    <Box display="flex" alignItems="center" gap={3} paddingY={2} minWidth={0}>
                      <ProductThumbnail product={product} />
                      <Text size={2} ellipsis display="block">
                        {product.name}
                      </Text>
                    </Box>
                  </Link>
                </Box>
                <Box __width="160px" flexShrink="0">
                  <ProductAvailabilityLabel product={product} />
                </Box>
                <Box __width="112px" flexShrink="0" display="flex" justifyContent="flex-end">
                  <Button
                    variant="tertiary"
                    type="button"
                    disabled={disabled}
                    onClick={() => handleUnassign([product.id])}
                    title={intl.formatMessage(messages.unassignProduct)}
                    icon={
                      <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
                    }
                    data-test-id="unassign-product"
                  />
                </Box>
              </Box>
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
                  changePage({});
                }}
                disabled={disabled}
                hasNextPage={paginator.hasNextPage}
                hasPreviousPage={paginator.hasPreviousPage}
                onNextPage={() => changePage({ after: products?.pageInfo.endCursor ?? undefined })}
                onPreviousPage={() =>
                  changePage({ before: products?.pageInfo.startCursor ?? undefined })
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
      </Box>

      <CollectionAssignProductDialog
        collectionId={collectionId}
        open={params.action === "assign"}
        disabled={disabled || assignResult.loading}
        confirmButtonState={getMutationStatus({
          ...assignResult,
          errors: assignResult.data?.collectionAddProducts.errors,
        })}
        errors={assignResult.data?.collectionAddProducts.errors ?? []}
        onClose={closeModal}
        onAssign={(productIds) => {
          if (productIds.length === 0) {
            closeModal();

            return;
          }

          void assignProduct({ variables: { collectionId, products: productIds } });
        }}
      />

      <UnassignProductsDialog
        open={params.action === "unassign" && (params.ids?.length ?? 0) > 0}
        count={params.ids?.length ?? 0}
        confirmButtonState={getMutationStatus({
          ...unassignResult,
          errors: unassignResult.data?.collectionRemoveProducts.errors,
        })}
        onClose={closeModal}
        onConfirm={() => handleUnassign(params.ids ?? [])}
      />
    </>
  );
};

CollectionProducts.displayName = "CollectionProducts";
