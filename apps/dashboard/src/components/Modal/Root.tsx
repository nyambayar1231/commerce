// Adapted from saleor-dashboard: src/components/Modal/Root.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Modal, type ModalRootProps } from "@saleor/macaw-ui";
import { ModalContextProvider } from "./context";

type RootProps = ModalRootProps;

export const Root = ({ children, onChange, open, ...rest }: RootProps) => {
  return (
    <ModalContextProvider onChange={onChange} open={open}>
      <Modal onChange={onChange} open={open} {...rest}>
        {children}
      </Modal>
    </ModalContextProvider>
  );
};
