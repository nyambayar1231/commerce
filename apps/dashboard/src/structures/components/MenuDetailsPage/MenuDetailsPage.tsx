// Adapted from saleor-dashboard: src/structures/components/MenuDetailsPage/MenuDetailsPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's layout: TopNav (back to the list, the name, the ⋯ menu with Delete), the Structure Items
// card in the main column, General Information in the right sidebar, the Savebar (Back, Save). The
// pending drag moves live here and Save sends the name and the moves together, as Saleor's page
// sends its tree operations. Not yet: translations, metadata, GraphiQL, extension menu items and app
// widgets.
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import type { MenuDetailsFragment, MenuErrorFragment } from "../../../graphql/types.generated";
import { buttonMessages } from "../../../intl";
import type { RecursiveMenuItem } from "../../types";
import { menuListUrl } from "../../urls";
import { MenuItems } from "../MenuItems/MenuItems";
import { computeRelativeTree, getDiff, type TreeOperation, treesDiffer } from "../MenuItems/tree";
import { MenuProperties } from "../MenuProperties/MenuProperties";

export interface MenuDetailsFormData {
  name: string;
}

export interface MenuDetailsSubmitData extends MenuDetailsFormData {
  moves: TreeOperation[];
}

interface MenuDetailsPageProps {
  menu: MenuDetailsFragment | undefined | null;
  errors: MenuErrorFragment[];
  disabled: boolean;
  saveButtonBarState: ConfirmButtonTransitionState;
  onSubmit: (data: MenuDetailsSubmitData) => Promise<unknown[]>;
  onDelete: () => void;
  onItemAdd: () => void;
  onItemEdit: (id: string) => void;
  onItemRemove: (id: string) => void;
}

export const MenuDetailsPage = ({
  menu,
  errors,
  disabled,
  saveButtonBarState,
  onSubmit,
  onDelete,
  onItemAdd,
  onItemEdit,
  onItemRemove,
}: MenuDetailsPageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { setIsDirty, setIsSubmitting } = useExitFormDialog();
  const serverItems: RecursiveMenuItem[] = menu?.items ?? [];
  const [name, setName] = useState(menu?.name ?? "");
  // One entry per drag, so Undo drops a whole gesture (a drag may need more than one move).
  const [moveGroups, setMoveGroups] = useState<TreeOperation[][]>([]);
  const operations = useMemo(() => moveGroups.flat(), [moveGroups]);
  const items = useMemo(
    () => computeRelativeTree(serverItems, operations),
    [serverItems, operations],
  );
  const hasUnsavedChanges = name !== (menu?.name ?? "") || treesDiffer(serverItems, items);
  const isSaveDisabled = disabled || !hasUnsavedChanges;

  // A changed server name (a save, or another session) updates the form.
  useEffect(() => {
    setName(menu?.name ?? "");
  }, [menu?.name]);

  useEffect(() => {
    setIsDirty(hasUnsavedChanges);
  }, [hasUnsavedChanges, setIsDirty]);

  const menuItems = useMemo((): TopNavMenuItem[] => {
    if (!menu?.id) {
      return [];
    }

    return [
      {
        label: intl.formatMessage(buttonMessages.delete),
        onSelect: onDelete,
        testId: "delete-menu",
        color: "critical1",
        icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
      },
    ];
  }, [menu?.id, onDelete, intl]);

  const handleChange = (newTree: RecursiveMenuItem[]) => {
    const diff = getDiff(items, newTree);

    if (diff.length > 0) {
      setMoveGroups((groups) => [...groups, diff]);
    }
  };

  const submit = async () => {
    if (isSaveDisabled) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onSubmit({ name, moves: operations });

      if (result.length === 0) {
        setMoveGroups([]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <DetailPageLayout>
        <TopNav
          href={menuListUrl()}
          hrefIcon={<TopNavDestinationIcon.modeling />}
          hrefTitle={intl.formatMessage(topNavDestinationMessages.allStructures)}
          title={menu?.name}
          actionsGap={3}
        >
          {menuItems.length > 0 && (
            <TopNav.Menu
              items={
                disabled || !menu
                  ? menuItems.map((item) => ({ ...item, disabled: true }))
                  : menuItems
              }
              dataTestId="menu"
            />
          )}
        </TopNav>
        <DetailPageLayout.Content>
          <DetailPageContent>
            <MenuItems
              canUndo={moveGroups.length > 0}
              items={items}
              onChange={handleChange}
              onItemAdd={onItemAdd}
              onItemEdit={onItemEdit}
              onItemRemove={onItemRemove}
              onUndo={() => setMoveGroups((groups) => groups.slice(0, -1))}
            />
          </DetailPageContent>
        </DetailPageLayout.Content>
        <DetailPageLayout.RightSidebar paddingTop={6} paddingX={6}>
          <MenuProperties
            data={{ name }}
            disabled={disabled}
            errors={errors}
            onChange={(event) => setName(event.target.value)}
          />
        </DetailPageLayout.RightSidebar>
        <Savebar>
          <Savebar.Spacer />
          <Savebar.CancelButton onClick={() => navigate(menuListUrl())} />
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

MenuDetailsPage.displayName = "MenuDetailsPage";
