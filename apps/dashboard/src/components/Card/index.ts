// Adapted from saleor-dashboard: src/components/Card/index.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Actions as BottomActions } from "./Actions";
import { Content } from "./Content";
import { Header } from "./Header";
import { Root } from "./Root";
import { CardSubtitle as Subtitle } from "./Subtitle";
import { Title } from "./Title";
import { Toolbar } from "./Toolbar";

// Todo this "pattern" doesnt properly infer props for root component
export const DashboardCard = Object.assign(Root, {
  Title,
  Content,
  BottomActions,
  Subtitle,
  Header,
  Toolbar,
});
