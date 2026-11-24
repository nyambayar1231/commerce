// Adapted from saleor-dashboard: src/modeling/views/PageCreate.tsx (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's PageCreate: the same details screen, empty, until Save. Ours has no page-type picker and
// no attributes, so it goes straight to the form; Save sends `pageCreate` and, on success, toasts
// and opens the new page at `/models/:id`.
import { useMutation } from "@apollo/client";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import { CreatePageDocument } from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import type { PageSubmitData } from "../components/PageDetailsPage/form";
import { messages } from "../components/PageDetailsPage/messages";
import { PageDetailsPage } from "../components/PageDetailsPage/PageDetailsPage";
import { pagePath } from "../urls";

export const PageCreate = () => {
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();

  const [createPage, createPageOpts] = useMutation(CreatePageDocument, {
    onCompleted: (result) => {
      if (result.pageCreate.errors.length > 0) {
        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(messages.pageCreated),
      });
      navigate(pagePath(result.pageCreate.page?.id ?? ""));
    },
  });

  const handleSubmit = async (formData: PageSubmitData): Promise<unknown[]> => {
    const result = await createPage({
      variables: {
        input: {
          title: formData.title,
          // The API takes EditorJS as JSONString (a JSON document inside a string); null clears it.
          content: formData.content ? JSON.stringify(formData.content) : null,
          isPublished: formData.isPublished,
        },
      },
    });

    return result.data?.pageCreate.errors ?? [];
  };

  return (
    <PageDetailsPage
      page={null}
      errors={createPageOpts.data?.pageCreate.errors ?? []}
      disabled={createPageOpts.loading}
      saveButtonBarState={getMutationStatus({
        ...createPageOpts,
        errors: createPageOpts.data?.pageCreate.errors,
      })}
      onSubmit={handleSubmit}
    />
  );
};

PageCreate.displayName = "PageCreate";
