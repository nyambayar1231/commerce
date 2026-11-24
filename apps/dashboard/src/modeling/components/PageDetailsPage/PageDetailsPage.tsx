// Adapted from saleor-dashboard: src/modeling/components/PageDetailsPage/PageDetailsPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's layout: TopNav (back to the list, the title, the ⋯ menu with Delete), General
// Information in the main column, the availability card in the right sidebar, the Savebar
// (save-composition hint, Back, Save). The same screen is used for a new page with `page={null}`
// (Saleor's PageCreate). Not yet: the slug/SEO card, the page type picker, attributes, metadata,
// translations, GraphiQL, extension menu items and app widgets.
import { Box } from "@saleor/macaw-ui";
import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import {
  TopNav,
  TopNavDestinationIcon,
  topNavDestinationMessages,
} from "../../../components/AppLayout/TopNav";
import type { TopNavMenuItem } from "../../../components/AppLayout/TopNav/Menu";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { DetailPageContent } from "../../../components/DetailPageContent/DetailPageContent";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import type { PageDetailsFragment, PageErrorFragment } from "../../../graphql/types.generated";
import { buttonMessages } from "../../../intl";
import { ProductAvailabilityCard } from "../../../products/components/ProductAvailabilityCard/ProductAvailabilityCard";
import { pageListPath } from "../../urls";
import { PageInfo } from "../PageInfo/PageInfo";
import { type PageSubmitData, usePageForm } from "./form";
import { messages } from "./messages";
import { PageSaveCompositionHint } from "./PageSaveCompositionHint";

interface PageDetailsPageProps {
  page: PageDetailsFragment | undefined | null;
  errors: PageErrorFragment[];
  disabled: boolean;
  saveButtonBarState: ConfirmButtonTransitionState;
  onSubmit: (data: PageSubmitData) => Promise<unknown[]>;
  onDelete?: () => void;
}

export const PageDetailsPage = ({
  page,
  errors,
  disabled,
  saveButtonBarState,
  onSubmit,
  onDelete,
}: PageDetailsPageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { data, change, changeIsPublished, submit, isSaveDisabled, saveComposition } = usePageForm(
    page,
    onSubmit,
    disabled,
  );

  const menuItems = useMemo((): TopNavMenuItem[] => {
    if (!page?.id || !onDelete) {
      return [];
    }

    return [
      {
        label: intl.formatMessage(buttonMessages.delete),
        onSelect: onDelete,
        testId: "delete-page",
        color: "critical1",
        icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
      },
    ];
  }, [page?.id, onDelete, intl]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DetailPageLayout>
        <TopNav
          href={pageListPath}
          hrefIcon={<TopNavDestinationIcon.modeling />}
          hrefTitle={intl.formatMessage(topNavDestinationMessages.allModels)}
          title={page === null ? intl.formatMessage(messages.title) : page?.title}
          actionsGap={3}
        >
          {menuItems.length > 0 && (
            <TopNav.Menu
              items={
                disabled || !page
                  ? menuItems.map((item) => ({ ...item, disabled: true }))
                  : menuItems
              }
              dataTestId="menu"
            />
          )}
        </TopNav>
        <DetailPageLayout.Content>
          <DetailPageContent>
            <PageInfo data={data} disabled={disabled} errors={errors} onChange={change} />
          </DetailPageContent>
        </DetailPageLayout.Content>
        <DetailPageLayout.RightSidebar paddingTop={6} paddingX={6}>
          <Box display="flex" flexDirection="column" gap={4}>
            <ProductAvailabilityCard
              isPublished={data.isPublished}
              publishedAt={page?.publishedAt}
              disabled={disabled}
              errors={errors}
              onChange={changeIsPublished}
              hiddenDescription={messages.hiddenPageDescription}
            />
          </Box>
        </DetailPageLayout.RightSidebar>
        <Savebar>
          <Savebar.Spacer />
          <PageSaveCompositionHint composition={saveComposition} />
          <Savebar.CancelButton onClick={() => navigate(pageListPath)} />
          <Savebar.ConfirmButton
            transitionState={saveButtonBarState}
            onClick={() => void submit()}
            disabled={isSaveDisabled}
          />
        </Savebar>
      </DetailPageLayout>
    </form>
  );
};

PageDetailsPage.displayName = "PageDetailsPage";
