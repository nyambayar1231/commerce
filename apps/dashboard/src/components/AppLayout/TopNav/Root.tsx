// Adapted from saleor-dashboard: src/components/AppLayout/TopNav/Root.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Without Saleor's channel picker (single channel, ADR-0005) and the contextual `subtitle` line.
import { Box, type BoxProps, Text } from "@saleor/macaw-ui";
import type { PropsWithChildren, ReactNode } from "react";

import { TopNavLink } from "./TopNavLink";
import { TopNavWrapper } from "./TopNavWrapper";

type TopNavBaseProps = {
  title: React.ReactNode;
  /** Compact eyebrow above the title — stacked in the same bar height as the destination button. */
  subtitleTop?: React.ReactNode;
  withoutBorder?: boolean;
  isAlignToRight?: boolean;
  /** Gap between header action buttons. Detail pages use a slightly wider spacing. */
  actionsGap?: 2 | 3;
};

type TopNavProps = TopNavBaseProps &
  (
    | {
        /** Destination URL for the leading nav control. */
        href: string;
        /** Icon representing that destination (not a generic back arrow). */
        hrefIcon: ReactNode;
        /** Tooltip / aria-label for the destination (e.g. "All products"). */
        hrefTitle: string;
      }
    | {
        href?: undefined;
        hrefIcon?: undefined;
        hrefTitle?: undefined;
      }
  );

export const Root = ({
  title,
  subtitleTop,
  href,
  hrefIcon,
  hrefTitle,
  withoutBorder = false,
  isAlignToRight = true,
  actionsGap = 2,
  children,
  ...wrapperProps
}: PropsWithChildren<TopNavProps> & Omit<BoxProps, keyof TopNavProps>) => {
  return (
    <TopNavWrapper withoutBorder={withoutBorder} hasSubtitle={false} {...wrapperProps}>
      <Box display="flex" alignItems="center" width="100%">
        {href && hrefIcon && hrefTitle ? (
          <TopNavLink to={href} icon={hrefIcon} title={hrefTitle} />
        ) : null}
        <Box
          __flex={isAlignToRight ? "1 1 auto" : 0}
          overflow="hidden"
          display="flex"
          flexDirection="column"
          justifyContent="center"
          gap={0.5}
          minWidth={0}
          title={typeof title === "string" ? title : undefined}
        >
          {subtitleTop ? (
            typeof subtitleTop === "string" ? (
              <Text size={2} color="default2" ellipsis display="block" __lineHeight={1.15}>
                {subtitleTop}
              </Text>
            ) : (
              <Box overflow="hidden" __lineHeight={1.15}>
                {subtitleTop}
              </Box>
            )
          ) : null}
          <Text size={6} ellipsis display="block" __lineHeight={subtitleTop ? 1.2 : undefined}>
            {title}
          </Text>
        </Box>
        <Box
          display="flex"
          flexWrap="nowrap"
          height="100%"
          gap={actionsGap}
          __flex={isAlignToRight ? "initial" : 1}
        >
          {children}
        </Box>
      </Box>
    </TopNavWrapper>
  );
};
