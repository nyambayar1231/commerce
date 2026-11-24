// Adapted from saleor-dashboard: src/collections/components/CollectionDetailsPage/CollectionDetailsPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's layout: TopNav (back to the list, the name, the ⋯ menu with Delete collection), General
// Information and the Products card in the main column, the availability card in the right sidebar,
// the Savebar (save-composition hint, Back, Save). Not yet: the SEO card with the slug, background
// image, metadata, translations, GraphiQL, extension menu items and app widgets.
// The collections destination icon lives here: TopNav's shared destination icons (a file outside
// this step) have no collections entry yet, and Saleor's icon is Layers (src/components/AppLayout/
// TopNav/destinationIcons.tsx).
import { Box } from "@saleor/macaw-ui";
import { Layers, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { TopNav } from "../../../components/AppLayout/TopNav";
import type { TopNavMenuItem } from "../../../components/AppLayout/TopNav/Menu";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { DetailPageContent } from "../../../components/DetailPageContent/DetailPageContent";
import { iconSize, iconStrokeWidthBySize, topNavLucideIconProps } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import type {
  CollectionDetailsFragment,
  CollectionErrorFragment,
} from "../../../graphql/types.generated";
import { ProductAvailabilityCard } from "../../../products/components/ProductAvailabilityCard/ProductAvailabilityCard";
import { collectionListPath } from "../../urls";
import { CollectionDetails } from "../CollectionDetails/CollectionDetails";
import { CollectionProducts } from "../CollectionProducts/CollectionProducts";
import { CollectionSaveCompositionHint } from "./CollectionSaveCompositionHint";
import { type CollectionUpdateData, useCollectionUpdateForm } from "./form";
import { messages } from "./messages";

interface CollectionDetailsPageProps {
  collectionId: string;
  collection: CollectionDetailsFragment | undefined | null;
  errors: CollectionErrorFragment[];
  disabled: boolean;
  saveButtonBarState: ConfirmButtonTransitionState;
  onSubmit: (data: CollectionUpdateData) => Promise<unknown[]>;
  onDelete: () => void;
}

export const CollectionDetailsPage = ({
  collectionId,
  collection,
  errors,
  disabled,
  saveButtonBarState,
  onSubmit,
  onDelete,
}: CollectionDetailsPageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { data, change, changeIsPublished, submit, isSaveDisabled, saveComposition } =
    useCollectionUpdateForm(collection, onSubmit, disabled);

  const menuItems = useMemo((): TopNavMenuItem[] => {
    if (!collection?.id) {
      return [];
    }

    return [
      {
        label: intl.formatMessage(messages.deleteCollection),
        onSelect: onDelete,
        testId: "delete-collection",
        color: "critical1",
        icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
      },
    ];
  }, [collection?.id, intl, onDelete]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DetailPageLayout>
        <TopNav
          href={collectionListPath}
          hrefIcon={<Layers {...topNavLucideIconProps} />}
          hrefTitle={intl.formatMessage(messages.allCollections)}
          title={collection?.name}
          actionsGap={3}
        >
          {menuItems.length > 0 && (
            <TopNav.Menu
              items={
                disabled || !collection
                  ? menuItems.map((item) => ({ ...item, disabled: true }))
                  : menuItems
              }
              dataTestId="menu"
            />
          )}
        </TopNav>
        <DetailPageLayout.Content>
          <DetailPageContent>
            <CollectionDetails data={data} disabled={disabled} errors={errors} onChange={change} />
            <CollectionProducts
              collection={collection}
              collectionId={collectionId}
              disabled={disabled}
            />
          </DetailPageContent>
        </DetailPageLayout.Content>
        <DetailPageLayout.RightSidebar paddingTop={6} paddingX={6}>
          <Box display="flex" flexDirection="column" gap={4}>
            <ProductAvailabilityCard
              isPublished={data.isPublished}
              publishedAt={collection?.publishedAt}
              disabled={disabled}
              errors={errors}
              onChange={changeIsPublished}
              hiddenDescription={messages.hiddenCollectionDescription}
            />
          </Box>
        </DetailPageLayout.RightSidebar>
        <Savebar>
          <Savebar.Spacer />
          <CollectionSaveCompositionHint composition={saveComposition} />
          <Savebar.CancelButton onClick={() => navigate(collectionListPath)} />
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

CollectionDetailsPage.displayName = "CollectionDetailsPage";
