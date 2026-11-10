// Copied from saleor-dashboard: src/products/components/ProductUpdatePage/ProductSaveCompositionHint.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's hint also lists attribute, channel and variant changes; this page saves product details
// only, so "details" is the single segment.
import { useIntl } from "react-intl";

import { SavebarCompositionHint } from "../../../components/Savebar/SavebarCompositionHint";
import {
  EMPTY_PRODUCT_SAVE_COMPOSITION,
  hasProductSaveComposition,
  type ProductSaveComposition,
} from "./form";
import { messages } from "./messages";

interface ProductSaveCompositionHintProps {
  composition?: ProductSaveComposition | null;
}

export const ProductSaveCompositionHint = ({
  composition = EMPTY_PRODUCT_SAVE_COMPOSITION,
}: ProductSaveCompositionHintProps) => {
  const intl = useIntl();
  const resolved = composition ?? EMPTY_PRODUCT_SAVE_COMPOSITION;

  if (!hasProductSaveComposition(resolved)) {
    return null;
  }

  return (
    <SavebarCompositionHint
      segments={[intl.formatMessage(messages.saveCompositionDetails)]}
      data-test-id="product-save-composition"
    />
  );
};
