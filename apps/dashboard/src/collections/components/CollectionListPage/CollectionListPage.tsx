// Adapted from saleor-dashboard: src/collections/components/CollectionListPage/CollectionListPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The header and card. Saleor shows "All Collections" as the label of its filter-presets dropdown
// next to a hidden TopNav title; without presets we show that label as text. Then Saleor's card:
// search, the publication filter (Saleor's ConditionalFilter; here a plain select, since our only
// filter is the status), the "Delete collections (N)" button while rows are selected, the grid and
// its pagination. Left out: the Filters panel, extension menu items, the create-button dropdown and
// the channel filter.
import { Box, Button, Select, Text } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { BulkDeleteButton } from "../../../components/BulkDeleteButton/BulkDeleteButton";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { ListSearchInput } from "../../../components/ListSearchInput/ListSearchInput";
import { sectionNames } from "../../../intl";
import type { CollectionListUrlStatus } from "../../urls";
import { CollectionListDatagrid } from "../CollectionListDatagrid/CollectionListDatagrid";
import { messages } from "./messages";

interface CollectionListPageProps extends ComponentProps<typeof CollectionListDatagrid> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
  status?: CollectionListUrlStatus;
  onStatusChange: (status?: CollectionListUrlStatus) => void;
  selectedCollectionIds: string[];
  onCollectionsDelete: () => void;
  onCreateCollection: () => void;
}

export const CollectionListPage = ({
  initialSearch,
  onSearchChange,
  status,
  onStatusChange,
  selectedCollectionIds,
  onCollectionsDelete,
  onCreateCollection,
  ...listProps
}: CollectionListPageProps) => {
  const intl = useIntl();
  // The "all" option's empty value clears the URL's `status`.
  const statusOptions: { label: string; value: CollectionListUrlStatus | "" }[] = [
    { label: intl.formatMessage(messages.allCollections), value: "" },
    { label: intl.formatMessage(messages.statusPublished), value: "published" },
    { label: intl.formatMessage(messages.statusHidden), value: "hidden" },
  ];

  return (
    <ListPageLayout>
      <TopNav
        title={intl.formatMessage(sectionNames.collections)}
        isAlignToRight={false}
        withoutBorder
      >
        <Box __flex={1} display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex">
            <Text size={6}>
              <FormattedMessage {...messages.allCollections} />
            </Text>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <Button data-test-id="create-collection" onClick={onCreateCollection} variant="primary">
              <FormattedMessage {...messages.createCollection} />
            </Button>
          </Box>
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
          <Box display="flex" alignItems="center" gap={4} __flex={1}>
            <Box __width="320px">
              <ListSearchInput
                initialSearch={initialSearch}
                placeholder={intl.formatMessage(messages.searchCollection)}
                onSearchChange={onSearchChange}
              />
            </Box>
            <Box __width="220px">
              <Select
                size="small"
                label={intl.formatMessage(messages.statusFilterLabel)}
                options={statusOptions}
                value={statusOptions.find((option) => option.value === (status ?? "")) ?? null}
                onChange={(option) => option && onStatusChange(option.value || undefined)}
                data-test-id="collection-status-filter"
              />
            </Box>
          </Box>
          <Box display="flex" alignItems="center" gap={4}>
            {selectedCollectionIds.length > 0 && (
              <BulkDeleteButton count={selectedCollectionIds.length} onClick={onCollectionsDelete}>
                <FormattedMessage {...messages.bulkCollectionDelete} />
              </BulkDeleteButton>
            )}
          </Box>
        </Box>
        <CollectionListDatagrid {...listProps} />
      </DashboardCard>
    </ListPageLayout>
  );
};
