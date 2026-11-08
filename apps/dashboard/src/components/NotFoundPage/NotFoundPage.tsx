// Adapted from saleor-dashboard: src/components/NotFoundPage/NotFoundPage.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Button, Text } from "@saleor/macaw-ui";
import { FormattedMessage } from "react-intl";

import notFoundImage from "../../assets/images/not-found-404.svg";
import styles from "./NotFoundPage.module.css";

interface NotFoundPageProps {
  onBack: () => void;
}

// Saleor inlines the SVG with react-inlinesvg; it has a fixed fill, so an <img> renders the same.
// Saleor's alternative `backHref` prop (Button as Link) has no caller here yet.
export const NotFoundPage = ({ onBack }: NotFoundPageProps) => (
  <div className={styles.root}>
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <div>
          <Text className={styles.header} size={6} fontWeight="bold" lineHeight={3}>
            <FormattedMessage id="yH56V+" defaultMessage="Ooops!..." />
          </Text>
          <Text className={styles.header} size={4} fontWeight="bold" lineHeight={2} display="block">
            <FormattedMessage id="bj6pTd" defaultMessage="Something's missing" />
          </Text>
          <Text display="block">
            <FormattedMessage id="nRiOg+" defaultMessage="Sorry, the page was not found" />
          </Text>
        </div>
        <div>
          <Button className={styles.button} variant="primary" onClick={onBack}>
            <FormattedMessage
              id="95oJ5d"
              defaultMessage="Go back to dashboard"
              description="button"
            />
          </Button>
        </div>
      </div>
      <div>
        <img className={styles.notFoundImage} src={notFoundImage} alt="" />
      </div>
    </div>
  </div>
);
