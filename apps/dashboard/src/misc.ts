// Adapted from saleor-dashboard: src/misc.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the helpers the dashboard uses so far.
import type { DefaultTheme } from "@saleor/macaw-ui";
import type { IntlShape } from "react-intl";

import {
  hueToPillColorDark,
  hueToPillColorLight,
  type PillColor,
} from "./components/Datagrid/customCells/PillCell";
import type {
  OrderAuthorizeStatusEnum,
  OrderChargeStatusEnum,
  OrderStatus,
} from "./graphql/types.generated";
import { commonStatusMessages, orderStatusMessages, paymentStatusMessages } from "./intl";

interface NamedUser {
  email: string;
  firstName: string;
  lastName: string;
}

export function getUserName(user: NamedUser | null | undefined, returnEmail?: boolean) {
  return user && (user.email || (user.firstName && user.lastName))
    ? user.firstName && user.lastName
      ? [user.firstName, user.lastName].join(" ")
      : returnEmail
        ? user.email
        : user.email.split("@")[0]
    : undefined;
}

export function getUserInitials(user?: NamedUser) {
  if (user?.firstName && user.lastName) {
    return (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
  }

  if (user?.email) {
    return user.email.slice(0, 2).toUpperCase();
  }

  return undefined;
}

// Saleor's StatusType and its order/payment status helpers, for the order list's pills.
export type StatusType = "info" | "error" | "warning" | "success" | "neutral" | "attention";

export interface OrderPaymentSummary {
  chargeStatus: OrderChargeStatusEnum;
  authorizeStatus: OrderAuthorizeStatusEnum;
  totalCharged: { amount: number };
  totalChargePending: { amount: number };
  totalRefunded: { amount: number };
}

/** Saleor's transformPaymentStatus: the payment pill's label and color from the order's totals. */
export const transformPaymentStatus = (
  {
    chargeStatus,
    authorizeStatus,
    totalCharged,
    totalChargePending,
    totalRefunded,
  }: OrderPaymentSummary,
  intl: IntlShape,
): { localized: string; status: StatusType } => {
  if (chargeStatus === "OVERCHARGED") {
    return { localized: intl.formatMessage(paymentStatusMessages.overcharged), status: "warning" };
  }

  if (totalChargePending.amount > 0) {
    return { localized: intl.formatMessage(paymentStatusMessages.pending), status: "warning" };
  }

  if (totalRefunded.amount > 0) {
    return totalCharged.amount > 0
      ? {
          localized: intl.formatMessage(paymentStatusMessages.partiallyRefunded),
          status: "attention",
        }
      : { localized: intl.formatMessage(paymentStatusMessages.refunded), status: "neutral" };
  }

  switch (chargeStatus) {
    case "FULL":
      return { localized: intl.formatMessage(paymentStatusMessages.paid), status: "success" };
    case "PARTIAL":
      return { localized: intl.formatMessage(paymentStatusMessages.partiallyPaid), status: "info" };
  }

  switch (authorizeStatus) {
    case "FULL":
      return { localized: intl.formatMessage(paymentStatusMessages.authorized), status: "info" };
    case "PARTIAL":
      return {
        localized: intl.formatMessage(paymentStatusMessages.partiallyAuthorized),
        status: "attention",
      };
    default:
      return { localized: intl.formatMessage(paymentStatusMessages.unpaid), status: "neutral" };
  }
};

/** Saleor's transformOrderStatus for the statuses our orders have. */
export const transformOrderStatus = (
  status: OrderStatus,
  intl: IntlShape,
): { localized: string; status: StatusType } => {
  switch (status) {
    case "FULFILLED":
      return { localized: intl.formatMessage(orderStatusMessages.fulfilled), status: "success" };
    case "PARTIALLY_FULFILLED":
      return {
        localized: intl.formatMessage(orderStatusMessages.partiallyFulfilled),
        status: "info",
      };
    case "UNFULFILLED":
      return { localized: intl.formatMessage(orderStatusMessages.unfulfilled), status: "warning" };
    case "CANCELED":
      return { localized: intl.formatMessage(commonStatusMessages.cancelled), status: "error" };
    case "DRAFT":
      return { localized: intl.formatMessage(orderStatusMessages.draft), status: "neutral" };
  }
};

const getStatusHue = (status: StatusType): number => {
  switch (status) {
    case "error":
      return 8;
    case "info":
      return 240;
    case "success":
      return 135;
    case "warning":
      return 75;
    case "attention":
      return 40;
    default:
      return 0;
  }
};

/** Saleor's getStatusColor: a pill's colors for the status, in the current theme. */
export const getStatusColor = ({
  status,
  currentTheme,
}: {
  status: StatusType;
  currentTheme: DefaultTheme;
}): PillColor => {
  const statusHue = getStatusHue(status);

  return currentTheme === "defaultDark"
    ? hueToPillColorDark(statusHue)
    : hueToPillColorLight(statusHue);
};
