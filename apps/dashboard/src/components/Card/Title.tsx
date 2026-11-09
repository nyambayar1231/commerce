// Adapted from saleor-dashboard: src/components/Card/Title.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Text, type TextProps } from "@saleor/macaw-ui";
import type { PropsWithChildren } from "react";

export const Title = ({ children, ...rest }: PropsWithChildren<TextProps>) => (
  <Text size={6} fontWeight="medium" __width="auto" {...rest}>
    {children}
  </Text>
);
