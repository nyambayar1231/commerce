// Adapted from saleor-dashboard: src/modeling/views/PageDetails.tsx (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The page's container: loads the page, saves it, deletes it. The open dialog lives in the URL as
// Saleor's (`action=remove`). Not yet: the metadata dialog, the attribute-value picker (no
// attributes), SEO, translations and page types.
import { useMutation, useQuery } from "@apollo/client";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import { useExitFormDialog } from "../../components/Form/useExitFormDialog";
import {
  PageDetailsDocument,
  PageUpdateDocument,
  RemovePageDocument,
} from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../NotFound";
import { PageDeleteDialog } from "../components/PageDeleteDialog/PageDeleteDialog";
import type { PageSubmitData } from "../components/PageDetailsPage/form";
import { messages } from "../components/PageDetailsPage/messages";
import { PageDetailsPage } from "../components/PageDetailsPage/PageDetailsPage";
import { pageListUrl, pageUrl, parsePageUrl } from "../urls";

export const PageDetails = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const params = parsePageUrl(searchParams);
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();
  const { resetFormsState } = useExitFormDialog();

  const { data, loading } = useQuery(PageDetailsDocument, { variables: { id } });
  const page = data?.page;

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = () => navigate(pageUrl(id, { action: "remove" }));
  const closeModal = () => navigate(pageUrl(id), { replace: true });

  const [updatePage, updateResult] = useMutation(PageUpdateDocument, {
    onCompleted: (result) => {
      if (result.pageUpdate.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.pageUpdated),
        });
      }
    },
  });

  const [deletePage, deleteResult] = useMutation(RemovePageDocument, {
    onCompleted: (result) => {
      if (result.pageDelete.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.pageDeleted),
        });
        // The page is gone: unsaved edits to it must not block leaving.
        resetFormsState();
        navigate(pageListUrl());
      }
    },
  });

  const handleUpdate = async (formData: PageSubmitData): Promise<unknown[]> => {
    const result = await updatePage({
      variables: {
        id,
        input: {
          title: formData.title,
          // The API takes EditorJS as JSONString (a JSON document inside a string); null clears it.
          content: formData.content ? JSON.stringify(formData.content) : null,
          isPublished: formData.isPublished,
        },
      },
    });

    return result.data?.pageUpdate.errors ?? [];
  };

  if (!loading && !page) {
    return <NotFound />;
  }

  return (
    <>
      <PageDetailsPage
        page={page}
        disabled={loading}
        errors={updateResult.data?.pageUpdate.errors ?? []}
        saveButtonBarState={getMutationStatus({
          ...updateResult,
          errors: updateResult.data?.pageUpdate.errors,
        })}
        onSubmit={handleUpdate}
        onDelete={openModal}
      />
      <PageDeleteDialog
        title={
          <FormattedMessage
            description="delete model"
            id="knO/IN"
            defaultMessage="Are you sure you want to delete {title}?"
            values={{ title: <strong>{page?.title ?? "..."}</strong> }}
          />
        }
        confirmButtonState={getMutationStatus({
          ...deleteResult,
          errors: deleteResult.data?.pageDelete.errors,
        })}
        onClose={closeModal}
        onConfirm={() => deletePage({ variables: { id } })}
        open={params.action === "remove"}
      />
    </>
  );
};
