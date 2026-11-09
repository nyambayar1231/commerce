// Adapted from saleor-dashboard: src/components/Modal/Close.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Button, Modal, type PropsWithBox } from "@saleor/macaw-ui";
import { X } from "lucide-react";
import { useIntl } from "react-intl";
import { buttonMessages } from "../../intl";
import { iconSize, iconStrokeWidth } from "../icons";

export const Close = (props: PropsWithBox<Record<string, never>>) => {
  const intl = useIntl();
  const closeLabel = intl.formatMessage(buttonMessages.close);

  return (
    <Modal.Close {...props}>
      <Button
        data-test-id="close-button"
        icon={<X size={iconSize.small} strokeWidth={iconStrokeWidth} />}
        size="small"
        type="button"
        variant="tertiary"
        aria-label={closeLabel}
        title={closeLabel}
      />
    </Modal.Close>
  );
};
