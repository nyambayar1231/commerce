// Adapted from saleor-dashboard: src/categories/components/CreateCategoryDialog/CreateCategoryDialog.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, Input, Text, Textarea } from "@saleor/macaw-ui";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import Form from "../../../components/Form/Form";
import { DashboardModal } from "../../../components/Modal";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import type { SubmitPromise } from "../../../hooks/useForm";
import { buttonMessages } from "../../../intl";
import { messages } from "./messages";

/** The part of EditorJS's `OutputData` this dialog produces (we don't ship EditorJS yet). */
export interface OutputData {
  time?: number;
  version?: string;
  blocks: { id?: string; type: string; data: { text: string } }[];
}

interface CreateCategoryFormData {
  name: string;
  description: string;
}

interface CreateCategoryDialogProps {
  open: boolean;
  /** When set, creates a child under this category. */
  parentId?: string | null;
  parentName?: string | null;
  confirmButtonState: ConfirmButtonTransitionState;
  disabled?: boolean;
  errors: ProductErrorFragment[];
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: OutputData | null;
  }) => SubmitPromise<ProductErrorFragment[]>;
}

const plainTextToEditorJsData = (text: string): OutputData | null => {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  return {
    blocks: [
      {
        type: "paragraph",
        data: { text: trimmed },
      },
    ],
  };
};

export const CreateCategoryDialog = ({
  open,
  parentId,
  parentName,
  confirmButtonState,
  disabled = false,
  errors: apiErrors,
  onClose,
  onSubmit,
}: CreateCategoryDialogProps): React.ReactNode => {
  const intl = useIntl();
  const [submitErrors, setSubmitErrors] = useState<ProductErrorFragment[]>([]);
  // Ignore Apollo's last mutation result until this open session submits again.
  const [showApiErrors, setShowApiErrors] = useState(false);
  // null = not synced yet, so the first open (including mount-with-open) still resets.
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null);
  const isChild = Boolean(parentId);
  const initialForm: CreateCategoryFormData = {
    name: "",
    description: "",
  };

  // Clear submit errors while rendering when `open` changes — resetting from an
  // effect that also remounts Form flashes the modal for a frame.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (prevOpen !== open) {
    setPrevOpen(open);
    setSubmitErrors([]);
    setShowApiErrors(false);
  }

  const fieldErrors = [...(showApiErrors ? apiErrors : []), ...submitErrors]
    .map((error) => error.message)
    .filter(Boolean)
    .join(" ");

  return (
    <DashboardModal onChange={onClose} open={open}>
      {open ? (
        <Form
          initial={initialForm}
          onSubmit={async (data) => {
            setShowApiErrors(true);

            const errors = await onSubmit({
              name: data.name.trim(),
              description: plainTextToEditorJsData(data.description),
            });

            setSubmitErrors(errors ?? []);

            return errors;
          }}
          disabled={disabled}
        >
          {({ change, data, submit }) => (
            <DashboardModal.Content size="sm" data-test-id="create-category-dialog">
              <DashboardModal.ContextHeader
                contextLabel={isChild && parentName ? parentName : undefined}
                description={
                  <FormattedMessage
                    {...(isChild ? messages.descriptionChild : messages.descriptionRoot)}
                  />
                }
              >
                <FormattedMessage {...(isChild ? messages.titleChild : messages.titleRoot)} />
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
                      data-test-id="category-name-input"
                      autoFocus
                    />
                    <Textarea
                      name="description"
                      label={intl.formatMessage(messages.descriptionField)}
                      value={data.description}
                      onChange={change}
                      disabled={disabled}
                      rows={4}
                      data-test-id="category-description-input"
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
                  disabled={disabled || !data.name.trim()}
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
