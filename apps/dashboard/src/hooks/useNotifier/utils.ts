// Adapted from saleor-dashboard: src/hooks/useNotifier/utils.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { INotification } from "../../components/notifications/NotificationContext";

// Saleor's DEFAULT_NOTIFICATION_SHOW_TIME (src/config.ts).
export const DEFAULT_NOTIFICATION_SHOW_TIME = 5000;

/**
 * Errors and action toasts stay until dismissed by default (WCAG 2.2.1 / Polaris).
 * Pass explicit `autohide` when the page already owns the persistent error
 * (inline field / section callout) and the toast is only a short action ack.
 * `actionBtn` stays sticky regardless.
 * Other statuses use autohide or the shared default; Sonner pauses on hover.
 */
export const getNotificationDuration = (options: INotification): number => {
  if (options.actionBtn) {
    return Infinity;
  }

  if (options.autohide !== undefined) {
    return options.autohide;
  }

  if (options.status === "error") {
    return Infinity;
  }

  return DEFAULT_NOTIFICATION_SHOW_TIME;
};
