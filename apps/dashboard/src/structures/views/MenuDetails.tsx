// Adapted from saleor-dashboard: src/structures/views/MenuDetails/index.tsx (BSD-3-Clause, Copyright
// (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The menu's container: loads it, saves the name and the pending tree moves together, deletes it,
// and creates/edits/deletes its items. The open dialog lives in the URL as Saleor's
// (`action=add-item|edit-item|remove`, the edited item in `id`). Item changes persist immediately,
// as the brief; not yet: translations, metadata and the GraphiQL/dev-mode panel.
import { useMutation, useQuery } from "@apollo/client";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import { useExitFormDialog } from "../../components/Form/useExitFormDialog";
import {
  MenuDeleteDocument,
  MenuDetailsDocument,
  MenuItemCreateDocument,
  MenuItemDeleteDocument,
  MenuItemUpdateDocument,
  MenuUpdateDocument,
} from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../NotFound";
import { MenuDeleteDialog } from "../components/MenuDeleteDialog/MenuDeleteDialog";
import {
  MenuDetailsPage,
  type MenuDetailsSubmitData,
} from "../components/MenuDetailsPage/MenuDetailsPage";
import { MenuItemDialog } from "../components/MenuItemDialog/MenuItemDialog";
import {
  getMenuItemCreateInputData,
  getMenuItemInputData,
} from "../components/MenuItemDialog/options";
import type { MenuItemDialogFormData } from "../components/MenuItemDialog/types";
import { messages } from "../messages";
import { menuListUrl, menuUrl, parseMenuUrl } from "../urls";
import { findMenuItem, getMenuItemDialogInitial, getMoves } from "../utils";

export const MenuDetails = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const params = parseMenuUrl(searchParams);
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();
  const { resetFormsState } = useExitFormDialog();

  const { data, loading, refetch } = useQuery(MenuDetailsDocument, { variables: { id } });
  const menu = data?.menu;

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openItemDialog = (action: "add-item" | "edit-item", itemId?: string) =>
    navigate(menuUrl(id, { action, id: itemId }));
  const openDeleteModal = () => navigate(menuUrl(id, { action: "remove" }));
  const closeModal = () => navigate(menuUrl(id), { replace: true });

  const [updateMenu, updateResult] = useMutation(MenuUpdateDocument, {
    onCompleted: (result) => {
      if (
        (result.menuUpdate?.errors.length ?? 0) === 0 &&
        (result.menuItemMove?.errors.length ?? 0) === 0
      ) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.menuUpdated),
        });
        void refetch();
      }
    },
  });

  const [deleteMenu, deleteResult] = useMutation(MenuDeleteDocument, {
    onCompleted: (result) => {
      if ((result.menuDelete?.errors.length ?? 0) === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.deletedStructure),
        });
        // The menu is gone: unsaved edits to it must not block leaving.
        resetFormsState();
        navigate(menuListUrl());
      }
    },
  });

  const [createItem, createResult] = useMutation(MenuItemCreateDocument, {
    onCompleted: (result) => {
      if ((result.menuItemCreate?.errors.length ?? 0) === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.menuUpdated),
        });
        closeModal();
        void refetch();
      }
    },
  });

  const [updateItem, updateItemResult] = useMutation(MenuItemUpdateDocument, {
    onCompleted: (result) => {
      if ((result.menuItemUpdate?.errors.length ?? 0) === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.menuUpdated),
        });
        closeModal();
        void refetch();
      }
    },
  });

  const [deleteItem] = useMutation(MenuItemDeleteDocument, {
    onCompleted: (result) => {
      if ((result.menuItemDelete?.errors.length ?? 0) === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.menuUpdated),
        });
        void refetch();
      }
    },
  });

  const handleUpdate = async (formData: MenuDetailsSubmitData): Promise<unknown[]> => {
    const result = await updateMenu({
      variables: {
        id,
        input: { name: formData.name },
        moves: getMoves(formData.moves),
      },
    });

    return [
      ...(result.data?.menuUpdate?.errors ?? []),
      ...(result.data?.menuItemMove?.errors ?? []),
    ];
  };

  const handleItemCreate = async (formData: MenuItemDialogFormData) => {
    const result = await createItem({
      variables: { input: getMenuItemCreateInputData(id, formData) },
    });

    return result.data?.menuItemCreate?.errors ?? [];
  };

  const handleItemUpdate = async (formData: MenuItemDialogFormData) => {
    const result = await updateItem({
      variables: { id: formData.id ?? params.id ?? "", input: getMenuItemInputData(formData) },
    });

    return result.data?.menuItemUpdate?.errors ?? [];
  };

  if (!loading && !menu) {
    return <NotFound />;
  }

  const itemToEdit = findMenuItem(menu?.items ?? [], params.id);

  return (
    <>
      <MenuDetailsPage
        menu={menu}
        disabled={loading && !data}
        errors={[
          ...(updateResult.data?.menuUpdate?.errors ?? []),
          ...(updateResult.data?.menuItemMove?.errors ?? []),
        ]}
        saveButtonBarState={getMutationStatus({
          ...updateResult,
          errors: [
            ...(updateResult.data?.menuUpdate?.errors ?? []),
            ...(updateResult.data?.menuItemMove?.errors ?? []),
          ],
        })}
        onSubmit={handleUpdate}
        onDelete={openDeleteModal}
        onItemAdd={() => openItemDialog("add-item")}
        onItemEdit={(itemId) => openItemDialog("edit-item", itemId)}
        onItemRemove={(itemId) => void deleteItem({ variables: { id: itemId } })}
      />
      <MenuDeleteDialog
        open={params.action === "remove"}
        confirmButtonState={getMutationStatus({
          ...deleteResult,
          errors: deleteResult.data?.menuDelete?.errors,
        })}
        onClose={closeModal}
        onConfirm={() => void deleteMenu({ variables: { id } })}
        subtitle={
          <FormattedMessage
            id="U2DyeR"
            defaultMessage="Are you sure you want to delete structure {menuName}?"
            values={{ menuName: <strong>{menu?.name ?? "..."}</strong> }}
          />
        }
      />
      <MenuItemDialog
        open={params.action === "add-item"}
        confirmButtonState={getMutationStatus({
          ...createResult,
          errors: createResult.data?.menuItemCreate?.errors,
        })}
        errors={createResult.data?.menuItemCreate?.errors ?? []}
        onSubmit={handleItemCreate}
        onClose={closeModal}
      />
      <MenuItemDialog
        open={params.action === "edit-item"}
        confirmButtonState={getMutationStatus({
          ...updateItemResult,
          errors: updateItemResult.data?.menuItemUpdate?.errors,
        })}
        errors={updateItemResult.data?.menuItemUpdate?.errors ?? []}
        initial={getMenuItemDialogInitial(itemToEdit)}
        onSubmit={handleItemUpdate}
        onClose={closeModal}
      />
    </>
  );
};
