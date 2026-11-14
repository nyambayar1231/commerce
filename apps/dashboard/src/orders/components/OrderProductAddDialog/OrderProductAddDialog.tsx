// Adapted from saleor-dashboard: src/orders/components/OrderProductAddDialog/OrderProductAddDialog.tsx,
// messages.ts and utils.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's product picker: a search box, then each published product with a checkbox that selects
// all its variants, and its variants (name, SKU, price) with their own checkboxes. Confirm adds one
// of each selected variant. Simplified: the first 20 matches (no infinite scroll or "load more
// variants"; the search narrows them), no channel name in the title (single channel), Macaw rows
// instead of Saleor's legacy table, Saleor's "Add products" as the title.
import { useQuery } from "@apollo/client";
import { Box, Checkbox, Input, Text } from "@saleor/macaw-ui";
import { useEffect, useMemo, useState } from "react";
import { defineMessage, defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import {
  type OrderErrorFragment,
  SearchOrderVariantDocument,
  type SearchOrderVariantQuery,
} from "../../../graphql/types.generated";
import useDebounce from "../../../hooks/useDebounce";
import { getOrderErrorMessage } from "../../../utils/errors";
import { messages as draftMessages } from "../OrderDraftDetails/OrderDraftDetails";

const skuMessage = defineMessage<{ sku: string }>({
  defaultMessage: "SKU {sku}",
  description: "variant sku",
  id: "+HuipK",
});

const messages = defineMessages({
  subtitle: {
    defaultMessage: "You can only add products available for the order's channel",
    id: "Taa5V7",
  },
  search: {
    defaultMessage: "Search products",
    id: "s6oAC+",
  },
  searchPlaceholder: {
    defaultMessage: "Search by product name, attribute, product type etc...",
    id: "S2xLxV",
  },
  noProducts: {
    id: "shmSDX",
    defaultMessage: "No products are available in the channel assigned to this order.",
  },
  confirm: {
    id: "N2IrpM",
    defaultMessage: "Confirm",
  },
});

type Product = NonNullable<SearchOrderVariantQuery["products"]>["edges"][number]["node"];
type Variant = Product["variants"][number];

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

interface OrderProductAddDialogProps {
  open: boolean;
  confirmButtonState: ConfirmButtonTransitionState;
  errors: OrderErrorFragment[];
  onClose: () => void;
  onSubmit: (variants: Variant[]) => void;
}

export const OrderProductAddDialog = ({
  open,
  confirmButtonState,
  errors,
  onClose,
  onSubmit,
}: OrderProductAddDialogProps) => {
  const intl = useIntl();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce<string>((value) => setSearch(value), SEARCH_DEBOUNCE_MS);
  const [selected, setSelected] = useState<Variant[]>([]);
  const { data, loading } = useQuery(SearchOrderVariantDocument, {
    variables: { first: PAGE_SIZE, query: search },
    skip: !open,
    fetchPolicy: "cache-and-network",
  });
  const products = useMemo(
    () =>
      (data?.products?.edges.map((edge) => edge.node) ?? []).filter(
        (product) => product.variants.length > 0,
      ),
    [data],
  );

  // A reopened dialog starts empty (Saleor resets its state on close).
  useEffect(() => {
    if (open) {
      setQuery("");
      setSearch("");
      setSelected([]);
    }
  }, [open]);

  const isSelected = (variant: Variant) => selected.some((item) => item.id === variant.id);
  const toggleVariant = (variant: Variant) =>
    setSelected((current) =>
      isSelected(variant)
        ? current.filter((item) => item.id !== variant.id)
        : [...current, variant],
    );
  // Saleor's onProductAdd: all of the product's variants on, or all off when they all were.
  const toggleProduct = (product: Product) => {
    const allSelected = product.variants.every(isSelected);

    setSelected((current) => [
      ...current.filter((item) => !product.variants.some((variant) => variant.id === item.id)),
      ...(allSelected ? [] : product.variants),
    ]);
  };

  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size="picker">
        <DashboardModal.Header subtitle={<FormattedMessage {...messages.subtitle} />}>
          <FormattedMessage {...draftMessages.addProducts} />
        </DashboardModal.Header>
        <Box paddingX={6} paddingBottom={4} data-test-id="search-query">
          <Input
            name="query"
            value={query}
            label={intl.formatMessage(messages.search)}
            placeholder={intl.formatMessage(messages.searchPlaceholder)}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              debouncedSearch(event.target.value);
            }}
          />
        </Box>
        <DashboardModal.Body fill data-test-id="add-products-table">
          {!loading && products.length === 0 ? (
            <Box paddingX={6} paddingY={4}>
              <Text color="default2">
                <FormattedMessage {...messages.noProducts} />
              </Text>
            </Box>
          ) : (
            products.map((product) => (
              <Box key={product.id} paddingX={6} data-test-id="product">
                <Box display="flex" alignItems="center" gap={3} paddingY={2}>
                  <Checkbox
                    checked={product.variants.every(isSelected)}
                    onCheckedChange={() => toggleProduct(product)}
                    aria-label={product.name}
                  />
                  {product.thumbnail?.url ? (
                    <img
                      src={product.thumbnail.url}
                      alt=""
                      width={32}
                      height={32}
                      style={{ borderRadius: 4, objectFit: "cover" }}
                    />
                  ) : (
                    <Box
                      __width="32px"
                      __height="32px"
                      borderRadius={2}
                      backgroundColor="default2"
                    />
                  )}
                  <Text data-test-id="product-name">{product.name}</Text>
                </Box>
                {product.variants.map((variant) => (
                  <Box
                    key={variant.id}
                    display="flex"
                    alignItems="center"
                    gap={3}
                    paddingY={2}
                    paddingLeft={8}
                    data-test-id="variant"
                  >
                    <Checkbox
                      checked={isSelected(variant)}
                      onCheckedChange={() => toggleVariant(variant)}
                      aria-label={[product.name, variant.name || variant.sku]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <Box __flex="1" display="flex" flexDirection="column">
                      <Text>{variant.name}</Text>
                      {variant.sku && (
                        <Text size={2} color="default2">
                          <FormattedMessage {...skuMessage} values={{ sku: variant.sku }} />
                        </Text>
                      )}
                    </Box>
                    <Text data-test-id="variant-price">
                      {intl.formatNumber(variant.price.amount, {
                        style: "currency",
                        currency: variant.price.currency,
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </Box>
                ))}
              </Box>
            ))
          )}
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
                  {getOrderErrorMessage(error, intl)}
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
            onClick={() => onSubmit(selected)}
            disabled={selected.length === 0}
          >
            <FormattedMessage {...messages.confirm} />
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};
