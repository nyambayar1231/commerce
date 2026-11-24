// Adapted from saleor-dashboard: src/collections/components/CollectionDetailsPage/CollectionSaveCompositionHint.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's page screen has no save composition; this follows its collection page.
import { useIntl } from "react-intl";

import { SavebarCompositionHint } from "../../../components/Savebar/SavebarCompositionHint";
import { messages } from "./messages";
import {
  EMPTY_PAGE_SAVE_COMPOSITION,
  hasPageSaveComposition,
  type PageSaveComposition,
} from "./saveComposition";

interface PageSaveCompositionHintProps {
  composition?: PageSaveComposition | null;
}

export const PageSaveCompositionHint = ({
  composition = EMPTY_PAGE_SAVE_COMPOSITION,
}: PageSaveCompositionHintProps) => {
  const intl = useIntl();
  const resolved = composition ?? EMPTY_PAGE_SAVE_COMPOSITION;

  if (!hasPageSaveComposition(resolved)) {
    return null;
  }

  const segments: string[] = [];

  if (resolved.hasGeneral) {
    segments.push(intl.formatMessage(messages.saveCompositionGeneral));
  }

  if (resolved.hasAvailability) {
    segments.push(intl.formatMessage(messages.saveCompositionAvailability));
  }

  return <SavebarCompositionHint segments={segments} data-test-id="page-save-composition" />;
};
