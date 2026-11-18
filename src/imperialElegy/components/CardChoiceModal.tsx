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
 * ids are the same ones the inline panel rendered.
 */
import React from "react";
import {bi} from "./boardHelpers";
import {useFocusTrap} from "./useFocusTrap";

export interface CardChoiceModalProps {
  /** Whether a required choice is on screen at all. */
  open: boolean;
  /** The home card is a blocker; the Goal pick may be closed. */
  dismissible: boolean;
  /** The choice form (`HandChoices`). */
  children?: React.ReactNode;
  locale: "en" | "zh_CN";
  title: string;
  onClose: () => void;
}

export const CardChoiceModal = ({open, dismissible, children, locale, title, onClose}: CardChoiceModalProps) => {
  // `onEscape` stays undefined for a blocker: `useFocusTrap` then swallows Esc
  // (it does not fall through to the board) instead of closing the dialog.
  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onEscape: dismissible ? onClose : undefined,
  });

  if (!open) return null;

  return (
    <div
      className="ie-choice-backdrop"
      data-testid="ie-choice-modal-backdrop"
      // Only a dismissible choice closes on a backdrop click; a blocker must be
      // answered, and a stray tap outside it must not read as "cancel".
      onClick={dismissible ? (event) => { if (event.target === event.currentTarget) onClose(); } : undefined}
    >
      <div
        ref={dialogRef}
        className="ie-choice-modal"
        data-testid="ie-choice-modal"
        data-dismissible={dismissible ? "true" : "false"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="ie-choice-head">
          <h2 className="ie-choice-title">{title}</h2>
          {dismissible ? (
            <button
              type="button"
              className="ie-btn secondary"
              data-testid="ie-choice-close"
              aria-label={bi(locale, "Close", "关闭")}
              title={bi(locale, "Close (Esc)", "关闭（Esc）")}
              onClick={onClose}
            >
              ✕
            </button>
          ) : (
            <span className="ie-muted" data-testid="ie-choice-required">
              {bi(locale, "This choice is required.", "此项为必选。")}
            </span>
          )}
        </header>
        <div className="ie-choice-body">{children}</div>
        {dismissible && (
          <footer className="ie-choice-foot">
            <button
              type="button"
              className="ie-btn"
              data-testid="ie-choice-continue"
              onClick={onClose}
            >
              {bi(locale, "Continue with the first Goal", "继续（保留第一张目标）")}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};
