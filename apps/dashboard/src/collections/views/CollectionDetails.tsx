// Adapted from saleor-dashboard: src/collections/views/CollectionDetails.tsx (BSD-3-Clause, Copyright
// (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The page's container: loads the collection, saves it, deletes it. The Products card owns its
// connection, the assign picker and the unassign dialog (see CollectionProducts); the open dialog
// lives in the URL as Saleor's (`action=remove|assign|unassign`, plus the rows in `ids`). Not yet:
// background image, SEO, metadata, translations and channel listings.
import { useMutation, useQuery } from "@apollo/client";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import { useExitFormDialog } from "../../components/Form/useExitFormDialog";
import {
  CollectionDetailsDocument,
  CollectionUpdateDocument,
  RemoveCollectionDocument,
} from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../NotFound";
import { CollectionDeleteDialog } from "../components/CollectionDeleteDialog/CollectionDeleteDialog";
import { CollectionDetailsPage } from "../components/CollectionDetailsPage/CollectionDetailsPage";
import type { CollectionUpdateData } from "../components/CollectionDetailsPage/form";
import { messages } from "../components/CollectionDetailsPage/messages";
import { collectionListUrl, collectionUrl, parseCollectionUrl } from "../urls";

export const CollectionDetails = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const params = parseCollectionUrl(searchParams);
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();
  const { resetFormsState } = useExitFormDialog();

  const { data, loading } = useQuery(CollectionDetailsDocument, { variables: { id } });
  const collection = data?.collection;

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = () => navigate(collectionUrl(id, { action: "remove" }));
  const closeModal = () => navigate(collectionUrl(id), { replace: true });

  const [updateCollection, updateResult] = useMutation(CollectionUpdateDocument, {
    onCompleted: (result) => {
      if (result.collectionUpdate.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.collectionUpdated),
        });
      }
    },
  });

  const [deleteCollection, deleteResult] = useMutation(RemoveCollectionDocument, {
    onCompleted: (result) => {
      if (result.collectionDelete.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.collectionDeleted),
        });
        // The collection is gone: unsaved edits to it must not block leaving.
        resetFormsState();
        navigate(collectionListUrl());
      }
    },
  });

  const handleUpdate = async (formData: CollectionUpdateData): Promise<unknown[]> => {
    const result = await updateCollection({
      variables: {
        id,
        input: {
          name: formData.name,
          // Saleor sends the description on every save; null clears it.
          description: formData.description ? JSON.stringify(formData.description) : null,
          isPublished: formData.isPublished,
        },
      },
    });

    return result.data?.collectionUpdate.errors ?? [];
  };

  if (!loading && !collection) {
    return <NotFound />;
  }

  return (
    <>
      <CollectionDetailsPage
        collectionId={id}
        collection={collection}
        disabled={loading}
        errors={updateResult.data?.collectionUpdate.errors ?? []}
        saveButtonBarState={getMutationStatus({
          ...updateResult,
          errors: updateResult.data?.collectionUpdate.errors,
        })}
        onSubmit={handleUpdate}
        onDelete={openModal}
      />
      <CollectionDeleteDialog
        collectionName={<strong>{collection?.name || "..."}</strong>}
        confirmButtonState={getMutationStatus({
          ...deleteResult,
          errors: deleteResult.data?.collectionDelete.errors,
        })}
        onClose={closeModal}
        onConfirm={() => deleteCollection({ variables: { id } })}
        open={params.action === "remove"}
      />
    </>
  );
};
