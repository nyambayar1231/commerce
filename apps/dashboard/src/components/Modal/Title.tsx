// Adapted from saleor-dashboard: src/components/Modal/Title.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Text, type TextProps } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

export interface TitleProps extends TextProps {
  children: ReactNode;
}

export const Title = ({ children, ...rest }: TitleProps) => {
  return (
    <Text size={6} fontWeight="bold" {...rest}>
      {children}
    </Text>
  );
};
