// Adapted from saleor-dashboard: src/components/Sidebar/SidebarCollapseToggle.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Initials instead of Saleor's logo image; no ripple badge or analytics. The rail drawer trigger
// (SidebarDrawerOpenButton) arrives with the rail layout in M0.3.8.

import { Avatar, Box, Text, Tooltip } from "@saleor/macaw-ui";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { type MouseEvent, type RefObject, useLayoutEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { iconSize, iconStrokeWidthBySize } from "../icons";

import { RAIL_OVERLAY_OFFSET } from "./menu/RailItem";
import { useLabelTooltip } from "./menu/useLabelTooltip";
import styles from "./SidebarCollapseToggle.module.css";
import { KeyboardShortcut } from "./shortcuts/KeyboardShortcut";
import { getShortcutLeadingKey } from "./shortcuts/utils";
import { sidebarCollapseMessages as messages } from "./sidebarCollapseMessages";
import { useSidebarCollapseToggle } from "./useSidebarCollapseToggle";

const iconProps = { size: iconSize.small, strokeWidth: iconStrokeWidthBySize.small } as const;

/**
 * The toggle icons show what they do, so the tooltip mostly teaches the shortcut. It waits for a
 * deliberate hover, so viewers who already know the shortcut don't see it on every pass.
 */
const TOGGLE_TOOLTIP_DELAY_MS = 700;

/**
 * Each state renders its own toggle, so toggling unmounts the focused one. Focus follows to the
 * toggle that replaces it in the same commit; after a mouse click focus is left alone, as it
 * would pop the tooltip.
 */
let isFocusHandoffPending = false;

const useToggleButton = (): {
  ref: RefObject<HTMLButtonElement>;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
} => {
  const toggle = useSidebarCollapseToggle();
  const ref = useRef<HTMLButtonElement>(null);
  const wasClickedWithPointer = useRef(false);

  useLayoutEffect(function handOffFocusBetweenToggles() {
    const button = ref.current;

    if (isFocusHandoffPending) {
      isFocusHandoffPending = false;
      button?.focus();
    }

    return () => {
      if (!wasClickedWithPointer.current && button?.contains(document.activeElement)) {
        isFocusHandoffPending = true;
        // Layout effects of the commit run synchronously, so a toggle that does not come back
        // (e.g. the layout changed) must not take focus later.
        queueMicrotask(() => {
          isFocusHandoffPending = false;
        });
      }
    };
  }, []);

  const onClick = (event: MouseEvent<HTMLButtonElement>): void => {
    // Enter and Space dispatch a click without pointer detail.
    wasClickedWithPointer.current = event.detail > 0;
    toggle();
  };

  return { ref, onClick };
};

const ToggleTooltipContent = ({ label }: { label: string }) => (
  <Box display="flex" alignItems="center" gap={2} __whiteSpace="nowrap">
    <Text size={2} fontWeight="medium">
      {label}
    </Text>
    <KeyboardShortcut>{`${getShortcutLeadingKey()} + B`}</KeyboardShortcut>
  </Box>
);

export const SidebarCollapseButton = () => {
  const intl = useIntl();
  const { ref, onClick } = useToggleButton();
  const tooltip = useLabelTooltip();
  const label = intl.formatMessage(messages.collapseNavigation);

  return (
    <Box position="relative" display="flex">
      <Tooltip {...tooltip.rootProps} delayDuration={TOGGLE_TOOLTIP_DELAY_MS}>
        <Tooltip.Trigger>
          <button
            ref={ref}
            type="button"
            className={styles.collapseButton}
            aria-label={label}
            onClick={onClick}
            data-test-id="sidebar-collapse-button"
          >
            <PanelLeftClose {...iconProps} aria-hidden />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom" align="end">
          <ToggleTooltipContent label={label} />
        </Tooltip.Content>
      </Tooltip>
    </Box>
  );
};

const ExpandButtonFace = ({ initials }: { initials: string }) => (
  <>
    <span className={styles.logo}>
      <Avatar.Store initials={initials} scheme="accent1" size="small" />
    </span>
    <span className={styles.expandIcon}>
      <PanelLeftOpen {...iconProps} aria-hidden />
    </span>
  </>
);

/** In the rail the store avatar doubles as the way back; hover or focus reveals the intent. */
export const SidebarExpandButton = ({ initials }: { initials: string }) => {
  const intl = useIntl();
  const { ref, onClick } = useToggleButton();
  const tooltip = useLabelTooltip();
  const label = intl.formatMessage(messages.expandNavigation);

  return (
    <Tooltip {...tooltip.rootProps} delayDuration={TOGGLE_TOOLTIP_DELAY_MS}>
      <Tooltip.Trigger>
        <button
          ref={ref}
          type="button"
          className={styles.expandButton}
          aria-label={label}
          onClick={onClick}
          data-test-id="sidebar-expand-button"
        >
          <ExpandButtonFace initials={initials} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content side="right" sideOffset={RAIL_OVERLAY_OFFSET}>
        <ToggleTooltipContent label={label} />
      </Tooltip.Content>
    </Tooltip>
  );
};
