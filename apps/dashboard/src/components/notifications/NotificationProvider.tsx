// Adapted from saleor-dashboard: src/components/notifications/NotificationProvider.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Without Saleor's "dismiss all" pill and live stack-offset sync (they matter once several toasts
// stack) and without the Savebar-aware bottom inset, which returns with the Savebar (M2.1.4).
import { type PropsWithChildren, type ReactNode, useMemo } from "react";
import { createPortal } from "react-dom";
import { Toaster, toast } from "sonner";

import { type INotificationContext, NotificationContext } from "./NotificationContext";
import styles from "./NotificationsToaster.module.css";
import { dismissAllToasts, MAX_VISIBLE_TOASTS } from "./notificationQueue";

const stopPropagation = (e: React.SyntheticEvent): void => {
  e.stopPropagation();
};

/** Equal gap above and below the dismiss pill. */
const TOAST_DISMISS_GAP_PX = 10;
/** Horizontal inset from the viewport edge. */
const TOAST_EDGE_INSET_PX = 20;
/** Vertical gap between expanded toasts. */
const TOAST_STACK_GAP_PX = 12;

/** Viewport toaster, rendered into `#toast-portal` (index.html) as Saleor does. */
export const NotificationsToaster = (): ReactNode => {
  const container = document.getElementById("toast-portal");

  if (!container) {
    return null;
  }

  return createPortal(
    // Stop event propagation to prevent clicks on toasts from closing modals
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops propagation; the toasts' own buttons are focusable
    // biome-ignore lint/a11y/useKeyWithClickEvents: as above, no action of its own
    <div
      className={styles.viewport}
      style={{ bottom: `${TOAST_DISMISS_GAP_PX}px`, right: TOAST_EDGE_INSET_PX }}
      onClick={stopPropagation}
      onPointerDown={stopPropagation}
    >
      <Toaster
        className={styles.toaster}
        position="bottom-right"
        expand
        gap={TOAST_STACK_GAP_PX}
        // Queue owns the visible cap; leave headroom so exiting toasts can animate out.
        visibleToasts={MAX_VISIBLE_TOASTS + 3}
        offset={{
          bottom: 0,
          right: 0,
        }}
      />
    </div>,
    container,
  );
};

const NotificationProvider = ({ children }: PropsWithChildren): ReactNode => {
  const context = useMemo<INotificationContext>(
    () => ({
      remove: (id: number): void => {
        toast.dismiss(id);
      },
      clearErrorNotifications: (): void => {
        dismissAllToasts();
      },
    }),
    [],
  );

  return <NotificationContext.Provider value={context}>{children}</NotificationContext.Provider>;
};

export { NotificationProvider };
