// Adapted from saleor-dashboard: src/components/AssignProductDialog/{AssignProductDialog,
// AssignProductDialogMulti, AssignProductPickerList, AssignProductPickerToolbar and messages}.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's product picker reduced to what assigning to a collection needs: a search box over the
// catalogue (`products(search)`), one checkbox per product with its thumbnail and name, and Assign.
// Simplified: the first 20 matches (no infinite scroll, filters or "select all visible"), and the
// products already in this collection are shown checked and disabled (Saleor hides them with
// `excludeProduct`) so the search still lists what it found.
import { useQuery } from "@apollo/client";
import { Box, Input, Spinner, Text } from "@saleor/macaw-ui";
import { Image } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import { Checkbox } from "../../../components/Checkbox/Checkbox";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import { DashboardModal } from "../../../components/Modal";
import { Table, TableBody, TableCell, TableRow } from "../../../components/Table/Table";
import {
  CollectionAssignProductSearchDocument,
  type CollectionAssignProductSearchQuery,
  type CollectionErrorFragment,
} from "../../../graphql/types.generated";
import useDebounce from "../../../hooks/useDebounce";
import { getProductErrorMessage } from "../../../utils/errors";

const messages = defineMessages({
  title: {
    id: "juxCV3",
    defaultMessage: "Assign product",
    description: "dialog header",
  },
  search: {
    id: "s6oAC+",
    defaultMessage: "Search products",
    description: "search label",
  },
  searchPlaceholder: {
    id: "515D7B",
    defaultMessage: "Search by product name...",
    description: "search placeholder",
  },
  assign: {
    id: "l+GuSi",
    defaultMessage: "Assign",
    description: "assign product dialog, button",
  },
  noProductsFound: {
    id: "wWELJW",
    defaultMessage: "No products found",
    description: "search results",
  },
});

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const COLUMNS = 3;

type Product = NonNullable<CollectionAssignProductSearchQuery["products"]>["edges"][number]["node"];

interface ProductThumbnailProps {
  product: Product;
}

// The 31×31 bordered thumbnail Saleor's product tables use, or a placeholder when the product has
// no media.
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
      <Box
        as="img"
        src={product.thumbnail.url}
        alt=""
        __width="31px"
        __height="31px"
        data-test-id="product-thumbnail"
      />
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

interface CollectionAssignProductDialogProps {
  collectionId: string;
  confirmButtonState: ConfirmButtonTransitionState;
  disabled?: boolean;
  errors: CollectionErrorFragment[];
  open: boolean;
  onClose: () => void;
  onAssign: (productIds: string[]) => void;
}

export const CollectionAssignProductDialog = ({
  collectionId,
  confirmButtonState,
  disabled = false,
  errors,
  open,
  onClose,
  onAssign,
}: CollectionAssignProductDialogProps) => {
  const intl = useIntl();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce<string>((value) => setSearch(value), SEARCH_DEBOUNCE_MS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, loading } = useQuery(CollectionAssignProductSearchDocument, {
    variables: { first: PAGE_SIZE, search },
    skip: !open,
    fetchPolicy: "cache-and-network",
  });

  // A reopened dialog starts empty.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSearch("");
      setSelectedIds([]);
    }
  }, [open]);

  const products = useMemo(
    () => (data?.products?.edges ?? []).map((edge) => edge.node),
    [data?.products?.edges],
  );
  const isAssigned = (product: Product) =>
    (product.collections ?? []).some((collection) => collection.id === collectionId);

  const toggle = (productId: string) =>
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );

  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size="picker" data-test-id="assign-product-dialog">
        <DashboardModal.PickerHeader
          toolbar={
            <Box data-test-id="search-query">
              <Input
                name="query"
                value={query}
                label={intl.formatMessage(messages.search)}
                placeholder={intl.formatMessage(messages.searchPlaceholder)}
                autoComplete="off"
                endAdornment={loading && <Spinner />}
                onChange={(event) => {
                  setQuery(event.target.value);
                  debouncedSearch(event.target.value);
                }}
              />
            </Box>
          }
        >
          <FormattedMessage {...messages.title} />
        </DashboardModal.PickerHeader>

        <DashboardModal.Body fill>
          <Table>
            <TableBody data-test-id="assign-products-table">
              {loading && products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS}>
                    <Box display="flex" justifyContent="center" padding={4}>
                      <Spinner />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS}>
                    <Box display="flex" justifyContent="center" padding={4}>
                      <Text size={2} color="default2" textAlign="center">
                        {intl.formatMessage(messages.noProductsFound)}
                      </Text>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const assigned = isAssigned(product);

                  return (
                    <TableRow key={product.id} data-test-id="assign-product-row">
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={assigned || selectedIds.includes(product.id)}
                          disabled={disabled || assigned}
                          aria-label={product.name}
                          onChange={() => toggle(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <ProductThumbnail product={product} />
                      </TableCell>
                      <TableCell data-test-id="product-name">{product.name}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </DashboardModal.Body>

        {errors.length > 0 && (
          <DashboardModal.Inset>
            <Box display="flex" flexDirection="column" gap={2}>
              {errors.map((error) => (
                <Text
                  display="block"
                  color="critical1"
                  key={`${error.code}-${error.field}`}
                  data-test-id="dialog-error"
                >
                  {getProductErrorMessage(error, intl)}
                </Text>
              ))}
            </Box>
          </DashboardModal.Inset>
        )}

        <DashboardModal.Actions>
          <BackButton onClick={onClose} data-test-id="back-button" />
          <ConfirmButton
            transitionState={confirmButtonState}
            data-test-id="confirm-button"
            onClick={() => onAssign(selectedIds)}
            disabled={disabled || selectedIds.length === 0}
          >
            <FormattedMessage {...messages.assign} />
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};

CollectionAssignProductDialog.displayName = "CollectionAssignProductDialog";
