// Adapted from saleor-dashboard: src/structures/components/MenuItemDialog/MenuItemDialog.tsx,
// MenuItemDialogLinkValue/MenuItemDialogLinkValue.tsx and
// MenuItemDialogLinkValue/useLinkValue.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's add/edit item dialog. The brief merges Saleor's "Link type" field and its per-kind
// search into one searchable select over categories, collections and pages, plus a "Link to:
// <typed URL>" row when the typed text is a URL or a path. The name and the link are both required,
// as Saleor's validation.

import { useQuery } from "@apollo/client";
import { Box, DynamicCombobox, Input } from "@saleor/macaw-ui";
import { useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import type { MenuErrorFragment } from "../../../graphql/types.generated";
import { MenuItemLinkSearchDocument } from "../../../graphql/types.generated";
import useDebounce from "../../../hooks/useDebounce";
import type { SubmitPromise } from "../../../hooks/useForm";
import { commonMessages, sectionNames } from "../../../intl";
import {
  getCommonFormFieldErrorMessage,
  getFieldError,
  getFormErrors,
} from "../../../utils/errors";
import {
  getLinkOption,
  getLinkOptions,
  type LinkOption,
  type LinkSearchResults,
  type LinkTypeLabels,
} from "./options";
import type { MenuItemDialogFormData } from "./types";

interface MenuItemDialogProps {
  open: boolean;
  confirmButtonState: ConfirmButtonTransitionState;
  errors: MenuErrorFragment[];
  /** The item being edited; absent when adding one. */
  initial?: MenuItemDialogFormData | null;
  onSubmit: (data: MenuItemDialogFormData) => SubmitPromise<MenuErrorFragment[]>;
  onClose: () => void;
}

const SEARCH_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

const LINK_FIELDS = ["category", "collection", "page", "url"] as const;

export const MenuItemDialog = ({
  open,
  confirmButtonState,
  errors: apiErrors,
  initial,
  onSubmit,
  onClose,
}: MenuItemDialogProps) => {
  const intl = useIntl();
  const labels = useMemo(
    (): LinkTypeLabels => ({
      category: intl.formatMessage(sectionNames.categories),
      collection: intl.formatMessage(sectionNames.collections),
      page: intl.formatMessage(sectionNames.models),
      url: intl.formatMessage({
        id: "uZbYst",
        defaultMessage: "Link to",
        description: "link option for a typed URL",
      }),
    }),
    [intl],
  );

  const [name, setName] = useState(initial?.name ?? "");
  const [link, setLink] = useState<LinkOption | null>(
    initial?.link ? getLinkOption(initial.link, labels) : null,
  );
  const [typedValue, setTypedValue] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce<string>((value) => setSearch(value), SEARCH_DEBOUNCE_MS);
  const [localErrors, setLocalErrors] = useState<{ name?: string; link?: string }>({});
  const [submitErrors, setSubmitErrors] = useState<MenuErrorFragment[]>([]);
  const [showApiErrors, setShowApiErrors] = useState(false);
  // null = not synced yet, so the first open (including mount-with-open) still resets.
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null);

  if (prevOpen !== open) {
    setPrevOpen(open);
    setName(initial?.name ?? "");
    setLink(initial?.link ? getLinkOption(initial.link, labels) : null);
    setTypedValue("");
    setSearch("");
    setLocalErrors({});
    setSubmitErrors([]);
    setShowApiErrors(false);
  }

  const { data, loading } = useQuery(MenuItemLinkSearchDocument, {
    variables: { first: SEARCH_PAGE_SIZE, search: search || null },
    skip: !open,
  });

  const results = useMemo<LinkSearchResults | undefined>(() => {
    if (!data) {
      return undefined;
    }

    return {
      categories: data.categories?.edges.map(({ node }) => node) ?? [],
      collections: data.collections?.edges.map(({ node }) => node) ?? [],
      pages: data.pages?.edges.map(({ node }) => node) ?? [],
    };
  }, [data]);

  const options = useMemo(() => {
    const built = getLinkOptions(results, typedValue, labels);

    // Keep the edited item's current link selectable when the first search page does not carry it.
    if (link && !built.some((option) => option.value === link.value)) {
      return [link, ...built];
    }

    return built;
  }, [results, typedValue, labels, link]);

  const isSubmitting = confirmButtonState === "loading";
  const linkApiError =
    LINK_FIELDS.map((field) => getFieldError(apiErrors, field)).find(Boolean) ?? undefined;
  const visibleApiErrors = showApiErrors ? apiErrors : [];
  const nameError =
    localErrors.name ||
    getCommonFormFieldErrorMessage(getFormErrors(["name"], visibleApiErrors).name, intl);
  const linkError =
    localErrors.link ||
    getCommonFormFieldErrorMessage(
      [...visibleApiErrors, ...submitErrors]
        .filter(
          (error) =>
            error.field === null ||
            (error.field !== undefined && (LINK_FIELDS as readonly string[]).includes(error.field)),
        )
        .find(Boolean),
      intl,
    ) ||
    (showApiErrors ? getCommonFormFieldErrorMessage(linkApiError, intl) : undefined);

  const handleSubmit = async () => {
    const nextErrors: { name?: string; link?: string } = {};

    if (!name.trim()) {
      nextErrors.name = intl.formatMessage(commonMessages.requiredField);
    }
    if (!link) {
      nextErrors.link = intl.formatMessage(commonMessages.requiredField);
    }

    setLocalErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setShowApiErrors(true);

    const errors = await onSubmit({
      id: initial?.id,
      name: name.trim(),
      link: link ? { type: link.linkType, value: link.linkValue, display: link.label } : null,
    });

    setSubmitErrors(errors ?? []);
  };

  return (
    <DashboardModal
      onChange={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      open={open}
    >
      {open ? (
        <DashboardModal.Content size="sm" data-test-id="menu-item-dialog">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <DashboardModal.ContextHeader data-test-id="menu-item-dialog-title">
              {initial ? (
                <FormattedMessage
                  description="edit structure, header"
                  id="GUeIcq"
                  defaultMessage="Edit Item"
                />
              ) : (
                <FormattedMessage
                  description="create new structure, header"
                  id="zJpP1T"
                  defaultMessage="Add Item"
                />
              )}
            </DashboardModal.ContextHeader>
            <DashboardModal.Body>
              <DashboardModal.Inset>
                <Box display="grid" gap={4}>
                  <Input
                    data-test-id="menu-item-name-input"
                    disabled={isSubmitting}
                    error={!!nameError}
                    helperText={nameError}
                    label={intl.formatMessage({
                      description: "structure name",
                      id: "z/pKCq",
                      defaultMessage: "Name",
                    })}
                    name="name"
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                    width="100%"
                  />
                  <DynamicCombobox<LinkOption>
                    data-test-id="menu-item-link-input"
                    disabled={isSubmitting}
                    error={!!linkError}
                    helperText={linkError}
                    label={intl.formatMessage({
                      id: "WDrC7e",
                      defaultMessage: "Link value",
                      description: "label",
                    })}
                    name="link"
                    options={options}
                    loading={loading}
                    value={link}
                    onChange={(option) => setLink(option)}
                    onInputValueChange={(value) => {
                      setTypedValue(value);
                      debouncedSearch(value);
                    }}
                    onFocus={() => debouncedSearch("")}
                  />
                </Box>
              </DashboardModal.Inset>
            </DashboardModal.Body>
            <DashboardModal.Actions>
              <BackButton disabled={isSubmitting} onClick={onClose} />
              <ConfirmButton
                data-test-id="submit"
                disabled={isSubmitting}
                onClick={() => void handleSubmit()}
                transitionState={confirmButtonState}
              >
                <FormattedMessage id="DJFPzq" defaultMessage="Confirm" description="button" />
              </ConfirmButton>
            </DashboardModal.Actions>
          </form>
        </DashboardModal.Content>
      ) : null}
    </DashboardModal>
  );
};

MenuItemDialog.displayName = "MenuItemDialog";
