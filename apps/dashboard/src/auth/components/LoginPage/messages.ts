// Adapted from saleor-dashboard: src/auth/components/LoginPage/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Ids copied unchanged from Saleor, except serverError: Saleor's text names Saleor, ours names the
// API (new id, formatjs's content hash as everywhere else).
import { defineMessages, type IntlShape } from "react-intl";

import type { UserContextError } from "../../AuthProvider";

const errorMessages = defineMessages({
  loginError: {
    id: "FopBSj",
    defaultMessage: "Your username and/or password are incorrect. Please try again.",
    description: "error message",
  },
  unknownLoginError: {
    id: "Wr5UOV",
    defaultMessage: "Login went wrong. Please try again.",
    description: "error message",
  },
  serverError: {
    id: "DI2hRC",
    defaultMessage: "The API is unavailable, please check your network connection and try again.",
    description: "error message",
  },
  noPermissionsError: {
    id: "7Jg9ec",
    defaultMessage: "You don't have permission to login.",
    description: "error message",
  },
});

export function getErrorMessage(err: UserContextError, intl: IntlShape): string {
  switch (err) {
    case "loginError":
    case "invalidCredentials":
      return intl.formatMessage(errorMessages.loginError);
    case "serverError":
      return intl.formatMessage(errorMessages.serverError);
    case "noPermissionsError":
      return intl.formatMessage(errorMessages.noPermissionsError);
    default:
      return intl.formatMessage(errorMessages.unknownLoginError);
  }
}
