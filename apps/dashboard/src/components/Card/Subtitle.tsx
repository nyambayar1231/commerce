// Adapted from saleor-dashboard: src/components/Card/Subtitle.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { type Sprinkles, Text } from "@saleor/macaw-ui";
import type { PropsWithChildren } from "react";

type CardSubtitleProps = Sprinkles;

export const CardSubtitle = ({ children, ...rest }: PropsWithChildren<CardSubtitleProps>) => (
  <Text size={4} fontWeight="light" display="block" {...rest}>
    {children}
  </Text>
);
