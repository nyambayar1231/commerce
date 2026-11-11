// Adapted from saleor-dashboard: src/products/components/ProductMediaPage/ProductMediaPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor 3.23's image page: TopNav ("<product> / Edit Image") with a link back to the product; on
// the left the product's image navigation and the "Media Information" card (alt text), on the
// right the sticky "Media View" card; Savebar (Delete, Back, Save). Images only, so the
// video/oEmbed branches, the metadata dialog and translations are not ported.
import { Box, Textarea } from "@saleor/macaw-ui";
import { Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";
import { savebarHeight, topBarHeight } from "../../../components/AppLayout/consts";
import { TopNav } from "../../../components/AppLayout/TopNav";
import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { DetailPageContent } from "../../../components/DetailPageContent/DetailPageContent";
import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import { topNavLucideIconProps } from "../../../components/icons";
import { DetailPageLayout } from "../../../components/Layouts/Detail";
import { Savebar } from "../../../components/Savebar";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { getProductErrorMessage } from "../../../utils/errors";
import { productUrl } from "../../urls";
import { ProductMediaNavigation } from "../ProductMediaNavigation/ProductMediaNavigation";
import { productMediaPageMessages as messages } from "./messages";

interface ProductMediaPageProps {
  productId: string;
  /** Undefined while the page loads; the TopNav then shows the title alone. */
  productName?: string;
  /** The product's images for the navigation; undefined until they resolve. */
  media?: ReadonlyArray<{ id: string; url: string; alt: string }>;
  /** The image open in the URL (`Product.mediaById`). */
  mediaObj?: { id: string; url: string; alt: string };
  errors: ProductErrorFragment[];
  disabled: boolean;
  saveButtonBarState: ConfirmButtonTransitionState;
  onDelete: () => void;
  onRowClick: (id: string) => () => void;
  onSubmit: (data: { alt: string }) => void;
}

export const ProductMediaPage = ({
  productId,
  productName,
  media,
  mediaObj,
  errors,
  disabled,
  saveButtonBarState,
  onDelete,
  onRowClick,
  onSubmit,
}: ProductMediaPageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const [alt, setAlt] = useState(mediaObj?.alt ?? "");

  // The saved alt coming back from the API resets the field (a different image remounts the page).
  useEffect(() => {
    setAlt(mediaObj?.alt ?? "");
  }, [mediaObj?.alt]);

  // Our API reports an over-long alt (Saleor's 250 limit) on `input`; its message names the limit.
  const altError = errors.find((error) => error.field === "input");
  const hasChanges = alt !== (mediaObj?.alt ?? "");
  const editMediaTitle = intl.formatMessage(messages.editImage);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ alt });
      }}
    >
      <DetailPageLayout gridTemplateColumns={1}>
        <TopNav
          href={productUrl(productId)}
          hrefIcon={<Tag {...topNavLucideIconProps} />}
          hrefTitle={intl.formatMessage(messages.product)}
          title={productName ? `${productName} / ${editMediaTitle}` : editMediaTitle}
          actionsGap={3}
        />
        <DetailPageLayout.Content>
          <DetailPageContent>
            <Box display="grid" __gridTemplateColumns="4fr 9fr" gap={4} alignItems="start">
              <Box display="flex" flexDirection="column" gap={4}>
                <ProductMediaNavigation
                  media={media}
                  highlighted={mediaObj?.id}
                  onRowClick={onRowClick}
                />
                <DetailSettingsCard title={intl.formatMessage(messages.mediaInformation)}>
                  <Textarea
                    name="alt"
                    data-test-id="product-media-alt-input"
                    label={intl.formatMessage(messages.altText)}
                    helperText={
                      altError
                        ? altError.message || getProductErrorMessage(altError, intl)
                        : undefined
                    }
                    error={Boolean(altError)}
                    disabled={disabled}
                    value={alt}
                    onChange={(event) => setAlt(event.target.value)}
                    rows={4}
                  />
                </DetailSettingsCard>
              </Box>
              <Box __position="sticky" __top="24px" __alignSelf="start">
                <DetailSettingsCard title={intl.formatMessage(messages.mediaView)}>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderWidth={1}
                    borderStyle="solid"
                    borderColor="default1"
                    borderRadius={2}
                    padding={2}
                    // Saleor's stage: fits below the top nav, the savebar and this card's header.
                    __height={`calc(100vh - ${topBarHeight} - ${savebarHeight} - 120px)`}
                    data-test-id="product-media-preview"
                  >
                    {mediaObj ? (
                      <img
                        src={mediaObj.url}
                        alt={mediaObj.alt}
                        style={{
                          display: "block",
                          maxHeight: "100%",
                          maxWidth: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : null}
                  </Box>
                </DetailSettingsCard>
              </Box>
            </Box>
          </DetailPageContent>
        </DetailPageLayout.Content>
        <Savebar>
          <Savebar.DeleteButton onClick={onDelete} />
          <Savebar.Spacer />
          <Savebar.CancelButton onClick={() => navigate(productUrl(productId))} />
          <Savebar.ConfirmButton
            transitionState={saveButtonBarState}
            onClick={() => onSubmit({ alt })}
            disabled={disabled || !hasChanges}
          />
        </Savebar>
      </DetailPageLayout>
    </form>
  );
};

ProductMediaPage.displayName = "ProductMediaPage";
