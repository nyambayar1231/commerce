// Adapted from saleor-dashboard: src/categories/views/CategoryDetails.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The page's container: loads the category, saves it, deletes it, and creates subcategories through
// Saleor's dialog (URL `action=create` / `action=delete`, as Saleor). Not yet: subcategory and
// product lists, bulk delete, background image, metadata (see CategoryUpdatePage).
import { useMutation, useQuery } from "@apollo/client";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { useExitFormDialog } from "../../components/Form/useExitFormDialog";
import {
  CategoryCreateDocument,
  CategoryDeleteDocument,
  CategoryDetailsDocument,
  CategoryUpdateDocument,
  type ProductErrorFragment,
} from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../NotFound";
import { CategoryDeleteDialog } from "../components/CategoryDeleteDialog/CategoryDeleteDialog";
import { CategoryUpdatePage } from "../components/CategoryUpdatePage/CategoryUpdatePage";
import type { CategoryUpdateData } from "../components/CategoryUpdatePage/form";
import { CreateCategoryDialog } from "../components/CreateCategoryDialog/CreateCategoryDialog";
import { messages as createCategoryMessages } from "../components/CreateCategoryDialog/messages";
import { getMutationStatus } from "../mutationStatus";
import { type CategoryUrlDialog, categoryListUrl, categoryUrl } from "../urls";

export const CategoryDetails = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action") as CategoryUrlDialog | null;
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();
  const { resetFormsState } = useExitFormDialog();

  const { data, loading } = useQuery(CategoryDetailsDocument, { variables: { id } });
  const category = data?.category;

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = (dialog: CategoryUrlDialog) => navigate(categoryUrl(id, { action: dialog }));
  const closeModal = () => navigate(categoryUrl(id), { replace: true });

  const [updateCategory, updateResult] = useMutation(CategoryUpdateDocument, {
    onCompleted: (result) => {
      if (result.categoryUpdate.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage({ id: "H4Lcuk", defaultMessage: "Category updated" }),
        });
      }
    },
  });

  const [deleteCategory, deleteResult] = useMutation(CategoryDeleteDocument, {
    onCompleted: (result) => {
      if (result.categoryDelete.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage({ id: "HvJPcU", defaultMessage: "Category deleted" }),
        });
        // The category is gone: unsaved edits to it must not block leaving.
        resetFormsState();
        navigate(categoryListUrl());
      }
    },
  });

  const [createCategory, createCategoryOpts] = useMutation(CategoryCreateDocument, {
    onCompleted: (result) => {
      if (result.categoryCreate.errors.length > 0) {
        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(createCategoryMessages.created),
      });
      closeModal();
      navigate(categoryUrl(result.categoryCreate.category?.id ?? ""));
    },
  });

  const handleUpdate = async (formData: CategoryUpdateData): Promise<ProductErrorFragment[]> => {
    const result = await updateCategory({
      variables: {
        id,
        input: {
          name: formData.name,
          // Saleor sends the description on every save; null clears it.
          description: formData.description ? JSON.stringify(formData.description) : null,
        },
      },
    });

    return result.data?.categoryUpdate.errors ?? [];
  };

  if (!loading && !category) {
    return <NotFound />;
  }

  return (
    <>
      <CategoryUpdatePage
        category={category}
        disabled={loading}
        errors={updateResult.data?.categoryUpdate.errors ?? []}
        saveButtonBarState={getMutationStatus({
          ...updateResult,
          errors: updateResult.data?.categoryUpdate.errors,
        })}
        onSubmit={handleUpdate}
        onDelete={() => openModal("delete")}
        onCreateSubcategory={() => openModal("create")}
      />
      <CreateCategoryDialog
        open={action === "create"}
        parentId={id}
        parentName={category?.name}
        onClose={closeModal}
        confirmButtonState={getMutationStatus({
          ...createCategoryOpts,
          errors: createCategoryOpts.data?.categoryCreate.errors,
        })}
        disabled={createCategoryOpts.loading}
        errors={createCategoryOpts.data?.categoryCreate.errors ?? []}
        onSubmit={async ({ name, description }) => {
          const result = await createCategory({
            variables: {
              parent: id,
              input: {
                name,
                ...(description?.blocks.length ? { description: JSON.stringify(description) } : {}),
              },
            },
          });

          return result.data?.categoryCreate.errors ?? [];
        }}
      />
      <CategoryDeleteDialog
        categoryName={<strong>{category?.name || "..."}</strong>}
        confirmButtonState={getMutationStatus({
          ...deleteResult,
          errors: deleteResult.data?.categoryDelete.errors,
        })}
        onClose={closeModal}
        onConfirm={() => deleteCategory({ variables: { id } })}
        open={action === "delete"}
      />
    </>
  );
};
