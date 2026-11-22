/**
 * A required card choice, raised as a modal.
 *
 * Two rules put a card choice on screen: the diplomacy step (pick one of your
 * home cards) and the end step (keep one of three National Goals).  Both are
 * blockers — nothing else in the Orders panel can be played around them — so
 * they used to be painted at the top of the Orders body, where they pushed the
 * space's action list below the fold and read as "one more panel".
 *
 * They are their own dialog now.  The home card cannot be dismissed (the step
 * cannot continue without one), while the Goal pick may be closed: continuing
 * keeps the first Goal, which is exactly what the printed hint promises.  Focus
 * is trapped, Escape closes only what may be closed, and focus returns to the
 * element that opened the dialog.
 *
 * The body is `HandChoices`, unchanged, so the faces, the buttons and their test
 * ids are the same ones the inline panel rendered.  The shell is the shared
 * `Modal`, so the card choice and the decision dialog cannot drift apart.
 */
import React from "react";
import {bi} from "./boardHelpers";
import {Modal} from "./Modal";

export interface CardChoiceModalProps {
  /** Whether a required choice is on screen at all. */
  open: boolean;
  /** A blocker cannot be closed; a dismissible choice may be. */
  dismissible: boolean;
  /** The choice form (`HandChoices`). */
  children?: React.ReactNode;
  locale: "en" | "zh_CN";
  title: string;
  /**
   * What the footer button says.  The Goal pick keeps the first Goal when it is
   * closed; a closed home-card dialog only hides the choice, which stays owed.
   */
  continueLabel?: string;
  onClose: () => void;
}

export const CardChoiceModal = ({open, dismissible, children, locale, title, continueLabel, onClose}: CardChoiceModalProps) => (
  <Modal
    open={open}
    dismissible={dismissible}
    locale={locale}
    title={title}
    onClose={onClose}
    testId="ie-choice-modal"
    backdropTestId="ie-choice-modal-backdrop"
    closeTestId="ie-choice-close"
    requiredTestId="ie-choice-required"
    footer={(
      <button
        type="button"
        className="ie-btn"
        data-testid="ie-choice-continue"
        onClick={onClose}
      >
        {continueLabel ?? bi(locale, "Continue with the first Goal", "继续（保留第一张目标）")}
      </button>
    )}
  >
    {children}
  </Modal>
);
