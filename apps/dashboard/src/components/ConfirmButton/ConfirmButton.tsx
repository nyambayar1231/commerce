// Adapted from saleor-dashboard: src/components/ConfirmButton/ConfirmButton.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Button, type ButtonProps, Spinner, sprinkles } from "@saleor/macaw-ui";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { defineMessages, useIntl } from "react-intl";
import { buttonMessages } from "../../intl";

import styles from "./ConfirmButton.module.css";

const DEFAULT_NOTIFICATION_SHOW_TIME = 3000;

const messages = defineMessages({
  tryAgain: {
    id: "Oy1LhB",
    defaultMessage: "Try again",
    description: "button error state label",
  },
});

export type ConfirmButtonTransitionState = "default" | "loading" | "success" | "error";

type ConfirmButtonLabels = Partial<Record<"confirm" | "error", string>>;

export interface ConfirmButtonProps extends ButtonProps {
  labels?: ConfirmButtonLabels;
  noTransition?: boolean;
  transitionState: ConfirmButtonTransitionState;
  onTransitionToDefault?: () => void;
}

// Here you can find original implementation
// https://github.com/saleor/macaw-ui/blob/canary/legacy/src/ConfirmButton/ConfirmButton.tsx

export const ConfirmButton = ({
  labels,
  noTransition,
  transitionState,
  onTransitionToDefault,
  onClick,
  disabled,
  children,
  variant,
  className,
  ...props
}: ConfirmButtonProps) => {
  const intl = useIntl();
  const [displayCompletedActionState, setDisplayCompletedActionState] = useState(false);
  const timeout = useRef<number>();
  const isLoading = transitionState === "loading";
  const isCompleted = noTransition ? transitionState !== "default" : displayCompletedActionState;
  const isSaveDisabled = !isCompleted && !!disabled;
  const isSuccess = transitionState === "success" && isCompleted;
  const isError = transitionState === "error" && isCompleted;
  const isInteractionLocked = isLoading || isSuccess;
  const defaultLabels: ConfirmButtonLabels = {
    confirm: intl.formatMessage(buttonMessages.save),
    error: intl.formatMessage(messages.tryAgain),
  };
  const componentLabels: ConfirmButtonLabels = {
    ...defaultLabels,
    ...labels,
  };

  useEffect(() => {
    if (!noTransition && transitionState === "loading") {
      setDisplayCompletedActionState(true);
    }
  }, [transitionState, noTransition]);
  useEffect(() => {
    if (noTransition) {
      return;
    }

    if ((["error", "success"] as ConfirmButtonTransitionState[]).includes(transitionState)) {
      timeout.current = setTimeout(() => {
        setDisplayCompletedActionState(false);

        if (onTransitionToDefault) {
          onTransitionToDefault();
        }
      }, DEFAULT_NOTIFICATION_SHOW_TIME) as unknown as number;
    } else if (transitionState === "loading") {
      clearTimeout(timeout.current);
    }

    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, [noTransition, transitionState, onTransitionToDefault]);

  const renderContent = () => {
    if (transitionState === "loading") {
      return (
        // Macaw's Spinner instead of Saleor's SaleorThrobber (as on the login page).
        <span data-test-id="button-progress" className={styles.indicator}>
          <Spinner />
        </span>
      );
    }

    if (transitionState === "success" && isCompleted) {
      return (
        // TODO: Replace with new component when it will be ready https://github.com/saleor/macaw-ui/issues/443
        <Check data-test-id="button-success" className={styles.indicator} />
      );
    }

    return null;
  };
  const getByLabelText = () => {
    if (isError) {
      return componentLabels.error;
    }

    return children || componentLabels.confirm;
  };

  return (
    <Button
      {...props}
      className={[
        styles.button,
        className,
        (isInteractionLocked || isSaveDisabled) && styles.noInteraction,
      ]
        .filter(Boolean)
        .join(" ")}
      variant={isError ? "error" : variant}
      disabled={isSaveDisabled}
      aria-busy={isLoading}
      tabIndex={isInteractionLocked ? -1 : undefined}
      onClick={isInteractionLocked ? undefined : onClick}
      data-test-state={isCompleted ? transitionState : "default"}
    >
      {renderContent()}
      <span
        className={sprinkles({
          opacity: ["loading", "success"].includes(transitionState) && isCompleted ? "0" : "1",
          transition: "ease",
        })}
      >
        {getByLabelText()}
      </span>
    </Button>
  );
};
