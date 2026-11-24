// Copied from saleor-dashboard: src/collections/components/CollectionDetailsPage/CollectionSaveCompositionHint.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useIntl } from "react-intl";

import { SavebarCompositionHint } from "../../../components/Savebar/SavebarCompositionHint";
import { messages } from "./messages";
import {
  type CollectionSaveComposition,
  EMPTY_COLLECTION_SAVE_COMPOSITION,
  hasCollectionSaveComposition,
} from "./saveComposition";

interface CollectionSaveCompositionHintProps {
  composition?: CollectionSaveComposition | null;
}

export const CollectionSaveCompositionHint = ({
  composition = EMPTY_COLLECTION_SAVE_COMPOSITION,
}: CollectionSaveCompositionHintProps) => {
  const intl = useIntl();
  const resolved = composition ?? EMPTY_COLLECTION_SAVE_COMPOSITION;

  if (!hasCollectionSaveComposition(resolved)) {
    return null;
  }

  const segments: string[] = [];

  if (resolved.hasGeneral) {
    segments.push(intl.formatMessage(messages.saveCompositionGeneral));
  }

  if (resolved.hasAvailability) {
    segments.push(intl.formatMessage(messages.saveCompositionAvailability));
  }

  return <SavebarCompositionHint segments={segments} data-test-id="collection-save-composition" />;
};
