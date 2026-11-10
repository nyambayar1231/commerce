// Adapted from saleor-dashboard: src/products/components/CreateProductDialog/CreateProductDialog.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's dialog shell: title, Back / Confirm, field errors on their inputs. Its product-type
// picker and the "create a product type" empty state are replaced by a name and an optional
// category (M2 decision 5); Saleor's separate variant creation is out of scope.
import { Box, Input } from "@saleor/macaw-ui";
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
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";
import { ProductCategoryPicker } from "../ProductOrganization/ProductOrganization";
import { messages } from "./messages";

interface CreateProductFields {
  name: string;
}

export interface CreateProductFormData {
  name: string;
  category: string | null;
}

interface CreateProductDialogProps {
  open: boolean;
  confirmButtonState: ConfirmButtonTransitionState;
  disabled?: boolean;
  errors: ProductErrorFragment[];
  onClose: () => void;
  onSubmit: (data: CreateProductFormData) => SubmitPromise<ProductErrorFragment[]>;
}

export const CreateProductDialog = ({
  open,
  confirmButtonState,
  disabled = false,
  errors: apiErrors,
  onClose,
  onSubmit,
}: CreateProductDialogProps): React.ReactNode => {
  const intl = useIntl();
  const [category, setCategory] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [submitErrors, setSubmitErrors] = useState<ProductErrorFragment[]>([]);
  // Ignore Apollo's last mutation result until this open session submits again.
  const [showApiErrors, setShowApiErrors] = useState(false);
  // null = not synced yet, so the first open (including mount-with-open) still resets.
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null);
  const initialForm: CreateProductFields = { name: "" };

  // Clear the dialog's own state while rendering when `open` changes — the same pattern as
  // CreateCategoryDialog (resetting from an effect flashes the modal for a frame).
  if (prevOpen !== open) {
    setPrevOpen(open);
    setCategory(null);
    setCategoryName("");
    setSubmitErrors([]);
    setShowApiErrors(false);
  }

  const formErrors = getFormErrors(
    ["name", "category"],
    [...(showApiErrors ? apiErrors : []), ...submitErrors],
  );

  return (
    <DashboardModal onChange={onClose} open={open}>
      {open ? (
        <Form
          initial={initialForm}
          onSubmit={async (data) => {
            setShowApiErrors(true);

            const errors = await onSubmit({
              name: data.name.trim(),
              category,
            });

            setSubmitErrors(errors ?? []);

            return errors;
          }}
          disabled={disabled}
        >
          {({ change, data, submit }) => (
            <DashboardModal.Content size="sm" data-test-id="create-product-dialog">
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
                      error={!!formErrors.name}
                      helperText={getProductErrorMessage(formErrors.name, intl)}
                      data-test-id="product-name-input"
                      autoFocus
                    />
                    <ProductCategoryPicker
                      category={category}
                      categoryName={categoryName}
                      disabled={disabled}
                      error={getProductErrorMessage(formErrors.category, intl)}
                      onCategoryChange={(value, name) => {
                        setCategory(value);
                        setCategoryName(name);
                      }}
                    />
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
