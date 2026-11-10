// Adapted from saleor-dashboard: src/products/components/ProductOrganization/ProductOrganization.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the category field (Saleor also organizes product type and collections). The picker is
// Saleor's DynamicCombobox fed by useCategorySearch; the current category is kept as an option so
// its name still shows when it isn't in the first page of search results. Clearing the input clears
// the category, which the API rejects while the product is published.
//
// `ProductCategoryPicker` is exported so the create dialog can reuse it without the card.
import { DynamicCombobox, type Option } from "@saleor/macaw-ui";
import { useMemo } from "react";
import { defineMessages, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { useCategorySearch } from "../../../searches/useCategorySearch";
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";

const messages = defineMessages({
  title: {
    id: "JjeZEG",
    defaultMessage: "Organize Product",
    description: "section header",
  },
  category: {
    id: "ccXLVi",
    defaultMessage: "Category",
  },
});

interface ProductCategoryPickerProps {
  /** The form's category: a global ID, or null when none is selected. */
  category: string | null;
  categoryName: string;
  disabled: boolean;
  error?: string;
  onCategoryChange: (category: string | null, categoryName: string) => void;
}

export const ProductCategoryPicker = ({
  category,
  categoryName,
  disabled,
  error,
  onCategoryChange,
}: ProductCategoryPickerProps) => {
  const intl = useIntl();
  const { categories, loading, search, loadMore } = useCategorySearch();

  // Downshift compares the selected item by reference, so the value object must be stable.
  const selectedCategory = useMemo<Option | null>(
    () => (category ? { value: category, label: categoryName } : null),
    [category, categoryName],
  );
  const options = useMemo<Option[]>(() => {
    if (!selectedCategory || categories.some((option) => option.value === selectedCategory.value)) {
      return categories;
    }

    return [selectedCategory, ...categories];
  }, [categories, selectedCategory]);

  return (
    <DynamicCombobox
      data-test-id="product-category"
      name="category"
      label={intl.formatMessage(messages.category)}
      disabled={disabled}
      options={disabled ? [] : options}
      value={selectedCategory}
      loading={loading}
      error={!!error}
      helperText={error}
      onChange={(option) => onCategoryChange(option?.value ?? null, option?.label ?? "")}
      onInputValueChange={search}
      onScrollEnd={loadMore}
      onFocus={() => search("")}
    />
  );
};

interface ProductOrganizationProps {
  /** The form's category: a global ID, or null when none is selected. */
  category: string | null;
  categoryName: string;
  disabled: boolean;
  errors: ProductErrorFragment[];
  onCategoryChange: (category: string | null, categoryName: string) => void;
}

export const ProductOrganization = ({
  category,
  categoryName,
  disabled,
  errors,
  onCategoryChange,
}: ProductOrganizationProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["category"], errors);

  return (
    <DetailSettingsCard
      title={intl.formatMessage(messages.title)}
      data-test-id="product-organization"
    >
      <ProductCategoryPicker
        category={category}
        categoryName={categoryName}
        disabled={disabled}
        error={getProductErrorMessage(formErrors.category, intl)}
        onCategoryChange={onCategoryChange}
      />
    </DetailSettingsCard>
  );
};
