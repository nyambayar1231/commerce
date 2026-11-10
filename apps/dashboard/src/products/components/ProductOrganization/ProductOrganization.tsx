// Adapted from saleor-dashboard: src/products/components/ProductOrganization/ProductOrganization.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the category field (Saleor also organizes product type and collections). The picker is
// Saleor's DynamicCombobox fed by useCategorySearch; the current category is kept as an option so
// its name still shows when it isn't in the first page of search results. Clearing the input clears
// the category, which the API rejects while the product is published.
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
  const { categories, loading, search, loadMore } = useCategorySearch();
  const formErrors = getFormErrors(["category"], errors);

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
    <DetailSettingsCard
      title={intl.formatMessage(messages.title)}
      data-test-id="product-organization"
    >
      <DynamicCombobox
        data-test-id="product-category"
        name="category"
        label={intl.formatMessage(messages.category)}
        disabled={disabled}
        options={disabled ? [] : options}
        value={selectedCategory}
        loading={loading}
        error={!!formErrors.category}
        helperText={getProductErrorMessage(formErrors.category, intl)}
        onChange={(option) => onCategoryChange(option?.value ?? null, option?.label ?? "")}
        onInputValueChange={search}
        onScrollEnd={loadMore}
        onFocus={() => search("")}
      />
    </DetailSettingsCard>
  );
};
