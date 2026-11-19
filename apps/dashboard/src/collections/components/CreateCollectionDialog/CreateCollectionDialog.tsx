// Adapted from saleor-dashboard: src/collections/components/CreateCollectionDialog/CreateCollectionDialog.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's dialog with the name field only (the detail page will edit the rest, M15.5b), and
// without Saleor's rich-text description. Unlike Saleor, Create stays enabled on a blank name so the
// API's "This field cannot be blank." error shows under the input (the brief's acceptance); the API
// is the authority either way. Errors are shown after the first submit of the open session only, so
// Apollo's previous result never leaks in.
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
import type { CollectionErrorFragment } from "../../../graphql/types.generated";
import type { SubmitPromise } from "../../../hooks/useForm";
import { buttonMessages } from "../../../intl";
import { messages } from "./messages";

interface CreateCollectionFormData {
  name: string;
}

interface CreateCollectionDialogProps {
  open: boolean;
  confirmButtonState: ConfirmButtonTransitionState;
  disabled?: boolean;
  errors: CollectionErrorFragment[];
  onClose: () => void;
  onSubmit: (data: { name: string }) => SubmitPromise<CollectionErrorFragment[]>;
}

export const CreateCollectionDialog = ({
  open,
  confirmButtonState,
  disabled = false,
  errors: apiErrors,
  onClose,
  onSubmit,
}: CreateCollectionDialogProps): React.ReactNode => {
  const intl = useIntl();
  const [submitErrors, setSubmitErrors] = useState<CollectionErrorFragment[]>([]);
  // Ignore Apollo's last mutation result until this open session submits again.
  const [showApiErrors, setShowApiErrors] = useState(false);
  // null = not synced yet, so the first open (including mount-with-open) still resets.
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null);
  const initialForm: CreateCollectionFormData = { name: "" };

  // Clear submit errors while rendering when `open` changes — resetting from an
  // effect that also remounts Form flashes the modal for a frame.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (prevOpen !== open) {
    setPrevOpen(open);
    setSubmitErrors([]);
    setShowApiErrors(false);
  }

  // The same API error arrives twice: through the mutation's result and as the submit's return
  // value, so show each message once.
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

            const errors = await onSubmit({ name: data.name.trim() });

            setSubmitErrors(errors ?? []);

            return errors;
          }}
          disabled={disabled}
        >
          {({ change, data, submit }) => (
            <DashboardModal.Content size="sm" data-test-id="create-collection-dialog">
              <DashboardModal.ContextHeader
                description={<FormattedMessage {...messages.description} />}
              >
                <FormattedMessage {...messages.title} />
              </DashboardModal.ContextHeader>

              <DashboardModal.Body>
                <DashboardModal.Inset>
                  <Box display="flex" flexDirection="column" gap={4}>
                    <Input
                      name="name"
                      label={intl.formatMessage(messages.name)}
                      value={data.name}
                      onChange={change}
                      disabled={disabled}
                      data-test-id="collection-name-input"
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
                  disabled={disabled}
                  data-test-id="submit"
                >
                  <FormattedMessage {...buttonMessages.create} />
                </ConfirmButton>
              </DashboardModal.Actions>
            </DashboardModal.Content>
          )}
        </Form>
      ) : null}
    </DashboardModal>
  );
};
