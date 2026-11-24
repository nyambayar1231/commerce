// Adapted from saleor-dashboard: src/structures/components/MenuCreateDialog/MenuCreateDialog.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's create dialog with the name field only. Create stays enabled on a blank name so the API's
// "This field cannot be blank." error shows under the input, as the collection and model dialogs.
import { Box, Input, Text } from "@saleor/macaw-ui";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import Form from "../../../components/Form/Form";
import { DashboardModal } from "../../../components/Modal";
import type { MenuErrorFragment } from "../../../graphql/types.generated";
import type { SubmitPromise } from "../../../hooks/useForm";
import { buttonMessages } from "../../../intl";

interface MenuCreateDialogFormData {
  name: string;
}

interface MenuCreateDialogProps {
  confirmButtonState: ConfirmButtonTransitionState;
  errors: MenuErrorFragment[];
  onClose: () => void;
  onConfirm: (data: MenuCreateDialogFormData) => SubmitPromise<MenuErrorFragment[]>;
  open: boolean;
}

const initialForm: MenuCreateDialogFormData = {
  name: "",
};

export const MenuCreateDialog = ({
  confirmButtonState,
  errors: apiErrors,
  onClose,
  onConfirm,
  open,
}: MenuCreateDialogProps) => {
  const intl = useIntl();
  const [submitErrors, setSubmitErrors] = useState<MenuErrorFragment[]>([]);
  // Ignore Apollo's last mutation result until this open session submits again.
  const [showApiErrors, setShowApiErrors] = useState(false);
  // null = not synced yet, so the first open (including mount-with-open) still resets.
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null);

  if (prevOpen !== open) {
    setPrevOpen(open);
    setSubmitErrors([]);
    setShowApiErrors(false);
  }

  const fieldErrors = [
    ...new Set(
      [...(showApiErrors ? apiErrors : []), ...submitErrors]
        .map((error) => error.message)
        .filter(Boolean),
    ),
  ].join(" ");

  return (
    <DashboardModal onChange={onClose} open={open}>
      {open ? (
        <Form
          initial={initialForm}
          onSubmit={async (data) => {
            setShowApiErrors(true);

            const errors = await onConfirm({ name: data.name.trim() });

            setSubmitErrors(errors ?? []);

            return errors;
          }}
        >
          {({ change, data, submit }) => (
            <DashboardModal.Content size="sm" data-test-id="create-menu-dialog">
              <DashboardModal.ContextHeader>
                <FormattedMessage
                  description="dialog header"
                  id="pSb46V"
                  defaultMessage="Create structure"
                />
              </DashboardModal.ContextHeader>
              <DashboardModal.Body>
                <DashboardModal.Inset>
                  <Box display="flex" flexDirection="column" gap={4}>
                    <Input
                      data-test-id="menu-name-input"
                      name="name"
                      label={intl.formatMessage({
                        id: "5KS3f4",
                        defaultMessage: "Structure title",
                      })}
                      value={data.name}
                      onChange={change}
                      autoFocus
                    />
                    {fieldErrors ? (
                      <Text size={2} color="critical1" as="p">
                        {fieldErrors}
                      </Text>
                    ) : null}
                  </Box>
                </DashboardModal.Inset>
              </DashboardModal.Body>
              <DashboardModal.Actions>
                <BackButton onClick={onClose} />
                <ConfirmButton
                  transitionState={confirmButtonState}
                  onClick={submit}
                  data-test-id="submit"
                >
                  <FormattedMessage {...buttonMessages.save} />
                </ConfirmButton>
              </DashboardModal.Actions>
            </DashboardModal.Content>
          )}
        </Form>
      ) : null}
    </DashboardModal>
  );
};

MenuCreateDialog.displayName = "MenuCreateDialog";
