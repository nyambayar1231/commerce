// Adapted from saleor-dashboard: src/orders/components/OrderProductAddDialog/OrderProductAddDialog.tsx,
// messages.ts and utils.ts, src/components/Money/Money.tsx, TableCellAvatar/ and
// AssignPickerList{EmptyState,Loading}/ (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's product picker: the picker header (title, subtitle, search box), then a table with one
// row per published product (Saleor's checkbox selecting all its variants, thumbnail, name) and a
// row per variant under it (its own checkbox, name and SKU, price). Confirm adds one of each
// selected variant. Simplified: the first 20 matches (no infinite scroll, backfill or "load more
// variants"; the search narrows them); single channel, so the title names the shop, there is no
// "only the order's channel" subtitle, and every published variant has a price.
import { useQuery } from "@apollo/client";
import { Box, Input, Spinner, Text } from "@saleor/macaw-ui";
import { Image } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { defineMessage, defineMessages, FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import { Checkbox } from "../../../components/Checkbox/Checkbox";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import { useShop } from "../../../components/Shop";
import { Table, TableBody, TableCell, TableRow } from "../../../components/Table/Table";
import {
  type OrderErrorFragment,
  SearchOrderVariantDocument,
  type SearchOrderVariantQuery,
} from "../../../graphql/types.generated";
import useDebounce from "../../../hooks/useDebounce";
import { getOrderErrorMessage } from "../../../utils/errors";
import styles from "./OrderProductAddDialog.module.css";

// react-intl's defineMessages cannot infer values; a message with values is typed on its own.
const titleMessage = defineMessage<{ channelName: string }>({
  defaultMessage: "Add product from {channelName}",
  description: "dialog header",
  id: "4XhJY+",
});

const skuMessage = defineMessage<{ sku: string }>({
  defaultMessage: "SKU {sku}",
  description: "variant sku",
  id: "+HuipK",
});

const messages = defineMessages({
  search: {
    defaultMessage: "Search products",
    description: "search label",
    id: "s6oAC+",
  },
  searchPlaceholder: {
    defaultMessage: "Search by product name, attribute, product type etc...",
    description: "search placeholder",
    id: "S2xLxV",
  },
  noProductsInChannel: {
    id: "shmSDX",
    defaultMessage: "No products are available in the channel assigned to this order.",
    description: "no products placeholder",
  },
  noProductsInQuery: {
    id: "9mrWKz",
    defaultMessage:
      "No products are available matching query in the channel assigned to this order.",
    description: "no products placeholder",
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
const COLUMNS = 4;

const isSelectedIn = (variant: Variant, selected: Variant[]) =>
  selected.some((item) => item.id === variant.id);

const Money = ({ amount, currency }: { amount: number; currency: string }) => {
  const intl = useIntl();

  return (
    <span className={styles.money} data-test-id="money-value">
      <span className={styles.currency}>{currency}</span>
      {intl.formatNumber(amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
    </span>
  );
};

const ListStateRow = ({ children }: { children: ReactNode }) => (
  <TableRow>
    <TableCell colSpan={COLUMNS} className={styles.stateCell}>
      <div className={styles.state}>{children}</div>
    </TableCell>
  </TableRow>
);

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
  const shop = useShop();
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

  // A reopened dialog starts empty (Saleor resets its state on open and close).
  useEffect(() => {
    if (open) {
      setQuery("");
      setSearch("");
      setSelected([]);
    }
  }, [open]);

  const toggleVariant = (variant: Variant) =>
    setSelected((current) =>
      isSelectedIn(variant, current)
        ? current.filter((item) => item.id !== variant.id)
        : [...current, variant],
    );
  // Saleor's onProductAdd: all of the product's variants on, or all off when they all were.
  const toggleProduct = (product: Product) =>
    setSelected((current) => {
      const allSelected = product.variants.every((variant) => isSelectedIn(variant, current));
      const others = current.filter((item) => !isSelectedIn(item, product.variants));

      return allSelected ? others : [...others, ...product.variants];
    });

  const showLoading = loading && products.length === 0;

  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size="picker">
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
          {intl.formatMessage(titleMessage, { channelName: shop?.name ?? "" })}
        </DashboardModal.PickerHeader>

        <DashboardModal.Body fill>
          <Table className={styles.table}>
            <TableBody data-test-id="add-products-table">
              {showLoading ? (
                <ListStateRow>
                  <Spinner />
                </ListStateRow>
              ) : products.length === 0 ? (
                <ListStateRow>
                  <Text size={2} color="default2" textAlign="center">
                    {intl.formatMessage(
                      search ? messages.noProductsInQuery : messages.noProductsInChannel,
                    )}
                  </Text>
                </ListStateRow>
              ) : (
                products.map((product) => (
                  <Fragment key={product.id}>
                    <TableRow data-test-id="product">
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={product.variants.every((variant) =>
                            isSelectedIn(variant, selected),
                          )}
                          disabled={loading}
                          aria-label={product.name}
                          onChange={() => toggleProduct(product)}
                        />
                      </TableCell>
                      <TableCell className={styles.avatar} data-test-id="table-cell-avatar">
                        <span className={styles.avatarImage}>
                          {product.thumbnail?.url ? (
                            <img src={product.thumbnail.url} alt="" />
                          ) : (
                            <Image size={20} aria-hidden />
                          )}
                        </span>
                      </TableCell>
                      <TableCell colSpan={2} data-test-id="product-name">
                        {product.name}
                      </TableCell>
                    </TableRow>
                    {product.variants.map((variant) => (
                      <TableRow key={variant.id} data-test-id="variant">
                        <TableCell />
                        <TableCell>
                          <Checkbox
                            className={styles.variantCheckbox}
                            checked={isSelectedIn(variant, selected)}
                            disabled={loading}
                            aria-label={[product.name, variant.name || variant.sku]
                              .filter(Boolean)
                              .join(" ")}
                            onChange={() => toggleVariant(variant)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>{variant.name}</div>
                          {variant.sku && (
                            <Box color="default2">
                              <FormattedMessage {...skuMessage} values={{ sku: variant.sku }} />
                            </Box>
                          )}
                        </TableCell>
                        <TableCell className={styles.textRight} data-test-id="variant-price">
                          <Text>
                            <Money
                              amount={variant.price.amount}
                              currency={variant.price.currency}
                            />
                          </Text>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
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
