// Adapted from saleor-dashboard: src/components/ConditionalFilter/queryVariables.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product and order lists' `where` variables. Saleor routes every field through
// FiltersQueryBuilder + QueryVarsBuilderUtils; we keep the same output shape for the five fields
// our API answers and write the mapping explicitly, one branch per field (ARCHITECTURE.md §9.3:
// no generic filter engine on either side).
import type {
  OrderStatus,
  OrderWhereInput,
  ProductWhereInput,
} from "../../graphql/types.generated";
import { ORDER_STATUSES } from "./constants";
import { type ConditionValue, isItemOption } from "./FilterElement/ConditionValue";
import { type FilterContainer, FilterElement } from "./FilterElement/FilterElement";

type DecimalFilter = NonNullable<ProductWhereInput["price"]>;
type IdFilter = NonNullable<ProductWhereInput["category"]>;
type DateFilter = NonNullable<ProductWhereInput["updatedAt"]>;

const DECIMAL = /^-?\d+(\.\d+)?$/;

const isDecimal = (value: string): boolean => DECIMAL.test(value);
const isDate = (value: string): boolean => !Number.isNaN(new Date(value).getTime());

/** The strings behind a selected value: raw strings from the URL, or option values from a picker. */
const valueStrings = (value: ConditionValue): string[] => {
  const values = Array.isArray(value) ? value : [value];

  return values.flatMap((item) => {
    if (typeof item === "string") {
      return [item];
    }

    return isItemOption(item) ? [item.value] : [];
  });
};

const booleanOf = (value: ConditionValue): boolean | null => {
  const [raw] = valueStrings(value);

  return raw === "true" ? true : raw === "false" ? false : null;
};

/** `{ gte | lte }` for `lower`, `greater` and `between`; null for any other condition. */
const rangeOf = (
  value: ConditionValue,
  label: string,
  valid: (value: string) => boolean,
): { gte?: string; lte?: string } | null => {
  const values = valueStrings(value);

  if (label === "lower") {
    return values.length === 1 && valid(values[0] as string) ? { lte: values[0] } : null;
  }

  if (label === "greater") {
    return values.length === 1 && valid(values[0] as string) ? { gte: values[0] } : null;
  }

  if (label === "between") {
    return values.length === 2 && values.every(valid) ? { gte: values[0], lte: values[1] } : null;
  }

  return null;
};

const categoryFilter = (value: ConditionValue, label: string): IdFilter | null => {
  if (label === "is") {
    const [id] = valueStrings(value);

    return id ? { eq: id } : null;
  }

  const ids = valueStrings(value).filter((id) => id.length > 0);

  return ids.length > 0 ? { oneOf: ids } : null;
};

const priceFilter = (value: ConditionValue, label: string): DecimalFilter | null => {
  if (label === "is") {
    const [amount] = valueStrings(value);

    return amount && isDecimal(amount) ? { eq: amount } : null;
  }

  const range = rangeOf(value, label, isDecimal);

  return range ? { range } : null;
};

const updatedAtFilter = (value: ConditionValue, label: string): DateFilter | null => {
  const range = rangeOf(value, label, isDate);

  return range ? { range } : null;
};

const elementToWhere = (element: FilterElement): ProductWhereInput | null => {
  const { value, conditionValue } = element.condition.selected;
  const label = conditionValue?.label;

  if (!label) {
    return null;
  }

  switch (element.value.value) {
    case "category": {
      const category = categoryFilter(value, label);

      return category ? { category } : null;
    }
    case "isPublished": {
      const isPublished = booleanOf(value);

      return isPublished === null ? null : { isPublished };
    }
    case "hasCategory": {
      const hasCategory = booleanOf(value);

      return hasCategory === null ? null : { hasCategory };
    }
    case "price": {
      const price = priceFilter(value, label);

      return price ? { price } : null;
    }
    case "updatedAt": {
      const updatedAt = updatedAtFilter(value, label);

      return updatedAt ? { updatedAt } : null;
    }
    default:
      return null;
  }
};

/**
 * The `where` argument of the product list query, or null when no filter applies. Several rows
 * are nested under `AND`, because our API rejects an object that mixes `AND` with fields.
 */
export const createProductQueryVariables = (
  filterContainer: FilterContainer,
): ProductWhereInput | null => {
  const filters = filterContainer
    .filter(FilterElement.isFilterElement)
    .filter((element) => !element.isEmpty())
    .map(elementToWhere)
    .filter((where): where is ProductWhereInput => where !== null);

  if (filters.length === 0) {
    return null;
  }

  if (filters.length === 1) {
    return filters[0] as ProductWhereInput;
  }

  return { AND: filters };
};

const isOrderStatus = (value: string): value is OrderStatus =>
  (ORDER_STATUSES as string[]).includes(value);

/**
 * The `where` argument of the order list query, or null when no filter applies. Status is the only
 * field (Saleor's `status: { eq | oneOf }`), and it occurs at most once.
 */
export const createOrderQueryVariables = (
  filterContainer: FilterContainer,
): OrderWhereInput | null => {
  const element = filterContainer
    .filter(FilterElement.isFilterElement)
    .find((element) => element.value.value === "status" && !element.isEmpty());

  if (!element) {
    return null;
  }

  const { value, conditionValue } = element.condition.selected;
  const statuses = valueStrings(value).filter(isOrderStatus);

  if (conditionValue?.label === "is") {
    const [status] = statuses;

    return status ? { status: { eq: status } } : null;
  }

  return statuses.length > 0 ? { status: { oneOf: statuses } } : null;
};
