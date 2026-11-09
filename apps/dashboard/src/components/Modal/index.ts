// Adapted from saleor-dashboard: src/components/Modal/index.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the parts our dialogs use so far; Grid, ModalSteps and PickerHeader come when needed.
import { Actions } from "./Actions";
import { Body } from "./Body";
import { Close } from "./Close";
import { Content, type ContentSize } from "./Content";
import { ContextHeader } from "./ContextHeader";
import { Header } from "./Header";
import { Inset } from "./Inset";
import { Root } from "./Root";
import { Title } from "./Title";

export type DashboardModalContentSize = ContentSize;

export const DashboardModal = Object.assign(Root, {
  Title,
  Content,
  Body,
  Actions,
  Close,
  ContextHeader,
  Header,
  Inset,
});
