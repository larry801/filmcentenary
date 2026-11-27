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
 * so there is no ✕, no backdrop click and Escape does not close it.  It *can*
 * be collapsed: the 收起 button hides the dialog so the reader can study the
 * board before answering, and the decision stays owed (the inline panel in the
 * Orders drawer keeps the option buttons, and the next decision re-raises the
 * dialog on its own).
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
  /** Fold the dialog out of the way; the decision stays owed. */
  onCollapse?: () => void;
}

export const DecisionModal = ({open, locale, t, onCollapse, ...body}: DecisionModalProps) => (
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
    collapseTestId="ie-decision-collapse"
    collapseLabel={bi(locale, "Collapse", "收起")}
    collapseTitle={bi(locale, "Collapse to inspect the board — the decision stays owed",
      "收起以查看态势——决策仍待答")}
    onCollapse={onCollapse}
    className="ie-decision-modal"
  >
    <DecisionBody {...body} locale={locale} t={t} inModal/>
  </Modal>
);
