// Adapted from saleor-dashboard: src/modeling/components/PageListPage/PageListPage.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The header and card: the "Models" title, the "Create model" button (straight to the new page's
// screen, as the brief's simplification), search, the "Delete model (N)" button while rows are
// selected, the grid and its pagination. Left out: the page-type tabs and their create dropdown,
// the bulk publish buttons, extension menu items, navigation pins and the channel filter.
import { Box, Button } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { BulkDeleteButton } from "../../../components/BulkDeleteButton/BulkDeleteButton";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { ListSearchInput } from "../../../components/ListSearchInput/ListSearchInput";
import { sectionNames } from "../../../intl";
import { PageListDatagrid } from "../PageListDatagrid/PageListDatagrid";
import { messages } from "./messages";

interface PageListPageProps extends ComponentProps<typeof PageListDatagrid> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
  selectedPageIds: string[];
  onPagesDelete: () => void;
  onPageCreate: () => void;
}

export const PageListPage = ({
  initialSearch,
  onSearchChange,
  selectedPageIds,
  onPagesDelete,
  onPageCreate,
  ...listProps
}: PageListPageProps) => {
  const intl = useIntl();

  return (
    <ListPageLayout>
      <TopNav title={intl.formatMessage(sectionNames.models)} withoutBorder>
        <Button data-test-id="create-page" onClick={onPageCreate} variant="primary">
          <FormattedMessage {...messages.createModel} />
        </Button>
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
            {selectedPageIds.length > 0 && (
              <BulkDeleteButton count={selectedPageIds.length} onClick={onPagesDelete}>
                <FormattedMessage {...messages.bulkDelete} />
              </BulkDeleteButton>
            )}
          </Box>
        </Box>
        <PageListDatagrid {...listProps} />
      </DashboardCard>
    </ListPageLayout>
  );
};

PageListPage.displayName = "PageListPage";
