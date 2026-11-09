// Adapted from saleor-dashboard: src/components/Form/ExitFormDialog.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Button } from "@saleor/macaw-ui";
import { type ReactNode, useRef } from "react";
import { useIntl } from "react-intl";

import BackButton from "../BackButton";
import { DashboardModal } from "../Modal";
import { exitFormPromptMessages as messages } from "./messages";

interface ExitFormDialogProps {
  onClose: () => void;
  onLeave: () => void;
  isOpen: boolean;
}

const ExitFormDialog = ({ onLeave, onClose, isOpen }: ExitFormDialogProps): ReactNode => {
  const intl = useIntl();
  // Ignore-changes calls onLeave, which sets `open` false. Modal onChange(false) must not
  // also run onClose ("keep editing") — that clears the pending navigation target.
  const isLeavingRef = useRef(false);

  return (
    <DashboardModal
      open={isOpen}
      onChange={(open) => {
        if (!open) {
          if (isLeavingRef.current) {
            isLeavingRef.current = false;

            return;
          }

          onClose();
        }
      }}
    >
      <DashboardModal.Content size="sm">
        <DashboardModal.Header>
          {intl.formatMessage(messages.unableToSaveTitle)}
        </DashboardModal.Header>
        <DashboardModal.Actions>
          <BackButton onClick={onClose}>{intl.formatMessage(messages.keepEditing)}</BackButton>
          <Button
            variant="primary"
            onClick={() => {
              isLeavingRef.current = true;
              onLeave();
            }}
            data-test-id="ignore-changes"
          >
            {intl.formatMessage(messages.ignoreChanges)}
          </Button>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};

export default ExitFormDialog;
