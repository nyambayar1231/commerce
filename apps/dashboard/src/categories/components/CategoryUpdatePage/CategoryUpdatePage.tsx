// Adapted from saleor-dashboard: src/categories/components/CategoryUpdatePage/CategoryUpdatePage.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's layout: TopNav (back to the parent or the list, the ⋯ menu with Create subcategory and
// Delete category), General Information, the Subcategories card in the right column, and the
// Savebar (save-composition hint, Back, Save). Not yet: the ancestors breadcrumb (needs
// `ancestors`, M2.1.6), Products card (M2.2), SEO card with the slug, background image (M2.5),
// metadata, translations, GraphiQL and extension menu items.
import { FolderPlus, Trash2 } from "lucide-react";
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
import type {
  CategoryDetailsFragment,
  ProductErrorFragment,
} from "../../../graphql/types.generated";
import { categoryListPath, categoryUrl } from "../../urls";
import { CategoryDetailsForm } from "../CategoryDetailsForm/CategoryDetailsForm";
import { CategorySubcategories } from "../CategorySubcategories/CategorySubcategories";
import { CategorySaveCompositionHint } from "./CategorySaveCompositionHint";
import { type CategoryUpdateData, useCategoryUpdateForm } from "./form";
import { messages } from "./messages";

interface CategoryUpdatePageProps {
  category: CategoryDetailsFragment | undefined | null;
  errors: ProductErrorFragment[];
  disabled: boolean;
  saveButtonBarState: ConfirmButtonTransitionState;
  onSubmit: (data: CategoryUpdateData) => Promise<unknown[]>;
  onDelete: () => void;
  onCreateSubcategory: () => void;
}

export const CategoryUpdatePage = ({
  category,
  errors,
  disabled,
  saveButtonBarState,
  onSubmit,
  onDelete,
  onCreateSubcategory,
}: CategoryUpdatePageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { data, change, submit, isSaveDisabled, saveComposition } = useCategoryUpdateForm(
    category,
    onSubmit,
    disabled,
  );
  const backHref = category?.parent?.id ? categoryUrl(category.parent.id) : categoryListPath;

  const menuItems = useMemo((): TopNavMenuItem[] => {
    if (!category?.id) {
      return [];
    }

    return [
      {
        label: intl.formatMessage(messages.createSubcategory),
        onSelect: onCreateSubcategory,
        testId: "create-subcategory-menu",
        icon: <FolderPlus size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
      },
      {
        label: intl.formatMessage(messages.deleteCategory),
        onSelect: onDelete,
        testId: "delete-category",
        color: "critical1",
        icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
      },
    ];
  }, [category?.id, intl, onCreateSubcategory, onDelete]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DetailPageLayout>
        <TopNav
          href={backHref}
          hrefIcon={<TopNavDestinationIcon.categories />}
          hrefTitle={intl.formatMessage(topNavDestinationMessages.allCategories)}
          title={category?.name}
          actionsGap={3}
        >
          {menuItems.length > 0 && (
            <TopNav.Menu
              items={
                disabled || !category
                  ? menuItems.map((item) => ({ ...item, disabled: true }))
                  : menuItems
              }
              dataTestId="menu"
            />
          )}
        </TopNav>
        <DetailPageLayout.Content>
          <DetailPageContent>
            <CategoryDetailsForm
              data={data}
              disabled={disabled}
              errors={errors}
              onChange={change}
            />
          </DetailPageContent>
        </DetailPageLayout.Content>
        <DetailPageLayout.RightSidebar paddingTop={6}>
          <CategorySubcategories disabled={disabled} onCreateSubcategory={onCreateSubcategory} />
        </DetailPageLayout.RightSidebar>
        <Savebar>
          <Savebar.Spacer />
          <CategorySaveCompositionHint composition={saveComposition} />
          <Savebar.CancelButton onClick={() => navigate(backHref)} />
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

CategoryUpdatePage.displayName = "CategoryUpdatePage";
