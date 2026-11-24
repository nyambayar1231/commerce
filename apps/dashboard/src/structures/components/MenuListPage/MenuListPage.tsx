// Adapted from saleor-dashboard: src/structures/components/MenuListPage/MenuListPage.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The header and card: the "Structures" title, the "All structures" label (Saleor shows it in place
// of its filter-presets dropdown), search, the "Delete structures (N)" button while rows are
// selected, "Create structure", the grid and its pagination. Left out: extension menu items, the
// presets bar, the column picker and Saleor's per-row delete icon.
import { Box, Button, Text } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { BulkDeleteButton } from "../../../components/BulkDeleteButton/BulkDeleteButton";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { ListSearchInput } from "../../../components/ListSearchInput/ListSearchInput";
import { sectionNames } from "../../../intl";
import { MenuList } from "../MenuList/MenuList";
import { messages } from "../MenuList/messages";

interface MenuListPageProps extends ComponentProps<typeof MenuList> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
  selectedMenuIds: string[];
  onMenusDelete: () => void;
  onCreateMenu: () => void;
}

export const MenuListPage = ({
  initialSearch,
  onSearchChange,
  selectedMenuIds,
  onMenusDelete,
  onCreateMenu,
  ...listProps
}: MenuListPageProps) => {
  const intl = useIntl();

  return (
    <ListPageLayout>
      <TopNav
        title={intl.formatMessage(sectionNames.structures)}
        isAlignToRight={false}
        withoutBorder
      >
        <Box __flex={1} display="flex" justifyContent="space-between" alignItems="center">
          <Text size={6}>
            <FormattedMessage
              id="vDp2tH"
              defaultMessage="All structures"
              description="all structures"
            />
          </Text>
          <Button data-test-id="create-menu" onClick={onCreateMenu} variant="primary">
            <FormattedMessage id="0dCGBW" defaultMessage="Create structure" description="button" />
          </Button>
        </Box>
      </TopNav>
      <DashboardCard>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap={4}
          paddingX={6}
          marginBottom={2}
        >
          <Box __width="320px">
            <ListSearchInput
              initialSearch={initialSearch}
              placeholder={intl.formatMessage(messages.searchPlaceholder)}
              onSearchChange={onSearchChange}
            />
          </Box>
          <Box display="flex" alignItems="center" gap={4}>
            {selectedMenuIds.length > 0 && (
              <BulkDeleteButton count={selectedMenuIds.length} onClick={onMenusDelete}>
                <FormattedMessage {...messages.bulkDelete} />
              </BulkDeleteButton>
            )}
          </Box>
        </Box>
        <MenuList {...listProps} />
      </DashboardCard>
    </ListPageLayout>
  );
};

MenuListPage.displayName = "MenuListPage";
