/**
 * A decision the rules are waiting on, raised as a modal.
 *
 * Every decision the board asks a seat to answer is a blocker: nothing else in
 * the Orders panel can be played around it, and painted inline it pushed the
 * space's action list below the fold and read as "one more panel".  So it is a
 * dialog now, over the board, with the same body (`DecisionBody`) the inline
 * panel used: the option buttons, the card faces and their test ids are the
 * ones the Orders body rendered.
 *
 * A decision cannot be dismissed — the step cannot continue without an answer —
 * so there is no ✕, no backdrop click and Escape does not close it.  Focus is
 * trapped and returns to the element that opened it.
 *
 * Only the seat being looked at raises the dialog: a hotseat mounts six boards
 * at once, and `useFocusTrap` focuses into its dialog on mount, so a hidden
 * seat must never pull the keyboard out of the visible board.
 */
import React from "react";
import {bi} from "./boardHelpers";
import {Modal} from "./Modal";
import {DecisionBody} from "./PendingPanel";
import type {PendingPanelProps} from "./PendingPanel";

export interface DecisionModalProps extends Omit<PendingPanelProps, "dock" | "inModal"> {
  /** Whether a decision is owed and on screen for this seat. */
  open: boolean;
}

export const DecisionModal = ({open, locale, t, ...body}: DecisionModalProps) => (
  <Modal
    open={open}
    // A decision must be answered: no ✕, no backdrop dismiss, Escape is held.
    dismissible={false}
    locale={locale}
    title={t.yourDecision}
    onClose={() => undefined}
    testId="ie-decision-modal"
    backdropTestId="ie-decision-modal-backdrop"
    requiredTestId="ie-decision-required"
    requiredLabel={bi(locale, "This decision is required.", "此项决策为必选。")}
    className="ie-decision-modal"
  >
    <DecisionBody {...body} locale={locale} t={t} inModal/>
  </Modal>
);
