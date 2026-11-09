// Adapted from saleor-dashboard: src/categories/components/CategorySubcategories/CategorySubcategories.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The card's header, intro and "Create subcategory" action. Saleor's subcategory grid (with its
// count, empty state, expand/collapse, pagination and bulk delete) arrives with the children
// connection and the Datagrid (M2.1.6–M2.1.8); until then the card shows no list rather than a
// misleading "No categories found".
import { Box, Button, Text } from "@saleor/macaw-ui";
import { FormattedMessage } from "react-intl";

import styles from "./CategorySubcategories.module.css";
import { messages } from "./messages";

interface CategorySubcategoriesProps {
  disabled: boolean;
  onCreateSubcategory: () => void;
}

export const CategorySubcategories = ({
  disabled,
  onCreateSubcategory,
}: CategorySubcategoriesProps) => (
  <Box className={styles.card} data-test-id="category-subcategories">
    <Box className={styles.header}>
      <Text size={5} fontWeight="bold" as="h2" className={styles.headerTitle}>
        <FormattedMessage {...messages.title} />
      </Text>
    </Box>

    <Box className={styles.intro}>
      <Text size={3} color="default2">
        <FormattedMessage {...messages.intro} />
      </Text>
    </Box>

    <Box className={styles.listFooter}>
      <Box className={styles.footerToolbar}>
        <Box className={styles.actions}>
          <Button
            variant="secondary"
            type="button"
            data-test-id="create-subcategory"
            disabled={disabled}
            onClick={onCreateSubcategory}
          >
            <FormattedMessage {...messages.create} />
          </Button>
        </Box>
      </Box>
    </Box>
  </Box>
);
