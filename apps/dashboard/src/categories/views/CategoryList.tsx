// Adapted from saleor-dashboard: src/categories/views/CategoryList/CategoryList.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the create flow so far: the URL's `action=create` opens Saleor's CreateCategoryDialog;
// on success a toast and a jump to the new category. The grid, search, sort, pagination, presets
// and bulk delete arrive with the list (M2.1.7–M2.1.8).
import { useMutation } from "@apollo/client";
import { useIntl } from "react-intl";
import { useNavigate, useSearchParams } from "react-router";

import { CategoryCreateDocument, type ProductErrorFragment } from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { CategoryListPage } from "../components/CategoryListPage/CategoryListPage";
import { CreateCategoryDialog } from "../components/CreateCategoryDialog/CreateCategoryDialog";
import { messages as createCategoryMessages } from "../components/CreateCategoryDialog/messages";
import { getMutationStatus } from "../mutationStatus";
import { type CategoryListUrlDialog, categoryListUrl, categoryUrl } from "../urls";

export const CategoryList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notify = useNotifier();
  const intl = useIntl();
  const action = searchParams.get("action") as CategoryListUrlDialog | null;

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = (dialog: CategoryListUrlDialog) =>
    navigate(categoryListUrl({ action: dialog }));
  const closeModal = () => navigate(categoryListUrl(), { replace: true });

  const [createCategory, createCategoryOpts] = useMutation(CategoryCreateDocument, {
    onCompleted: (data) => {
      if ((data.categoryCreate.errors.length ?? 0) > 0) {
        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(createCategoryMessages.created),
      });
      closeModal();
      navigate(categoryUrl(data.categoryCreate.category?.id ?? ""));
    },
  });

  return (
    <>
      <CategoryListPage onCreateCategory={() => openModal("create")} />
      <CreateCategoryDialog
        open={action === "create"}
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
              parent: null,
              input: {
                name,
                // Saleor's getParsedDataForJsonStringField: JSON only when there are blocks.
                ...(description?.blocks.length ? { description: JSON.stringify(description) } : {}),
              },
            },
          });

          return (result.data?.categoryCreate.errors ?? []) as ProductErrorFragment[];
        }}
      />
    </>
  );
};
