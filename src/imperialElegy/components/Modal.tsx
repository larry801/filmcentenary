/**
 * The board's one dialog primitive.
 *
 * Two things in the game are dialogs rather than panels: a required card
 * choice (the diplomacy home card, the end-step National Goal) and a decision
 * the rules are waiting on (a pending decision, an open battle, the final
 * score).  Both are blockers — nothing else in the Orders panel can be played
 * around them — and both used to be painted inline, where they pushed the
 * space's action list below the fold and read as "one more panel".
 *
 * This component owns the shared shell: the backdrop, the dialog frame, the
 * title bar, the focus trap and the `data-dismissible` contract the stylesheet
 * and the suites read.  Each caller supplies its own test ids so the existing
 * `ie-choice-*` anchors keep working while the decision dialog gets its own.
 *
 * `useFocusTrap` is given no Escape handler for a blocker, which makes the trap
 * *hold* Escape (it does not leak to the board) instead of closing the dialog.
 */
import React from "react";
import {bi} from "./boardHelpers";
import {useFocusTrap} from "./useFocusTrap";

export interface ModalProps {
  /** Whether the dialog is on screen at all. */
  open: boolean;
  /** A blocker cannot be closed; a dismissible dialog may be. */
  dismissible: boolean;
  locale: "en" | "zh_CN";
  title: string;
  onClose: () => void;
  /** The dialog element's test id (`role="dialog"`). */
  testId: string;
  backdropTestId?: string;
  closeTestId?: string;
  requiredTestId?: string;
  /** Shown in the title bar instead of ✕ for a blocker. */
  requiredLabel?: string;
  /**
   * A blocker may still be folded out of the way without answering: the
   * collapse button hides the dialog while the decision stays owed.  The host
   * keeps a reopen affordance; this button only hides the frame.
   */
  collapseTestId?: string;
  collapseTitle?: string;
  collapseLabel?: string;
  onCollapse?: () => void;
  /** Footer content; only rendered for a dismissible dialog. */
  footer?: React.ReactNode;
  /** Extra class on the dialog frame (a wider decision dialog, for example). */
  className?: string;
  children?: React.ReactNode;
}

export const Modal = ({
  open, dismissible, locale, title, onClose,
  testId, backdropTestId, closeTestId, requiredTestId, requiredLabel,
  collapseTestId, collapseTitle, collapseLabel, onCollapse,
  footer, className = "", children,
}: ModalProps) => {
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
      data-testid={backdropTestId}
      // Only a dismissible dialog closes on a backdrop click; a blocker must be
      // answered, and a stray tap outside it must not read as "cancel".
      onClick={dismissible ? (event) => { if (event.target === event.currentTarget) onClose(); } : undefined}
    >
      <div
        ref={dialogRef}
        className={`ie-choice-modal${className === "" ? "" : ` ${className}`}`}
        data-testid={testId}
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
              data-testid={closeTestId}
              aria-label={bi(locale, "Close", "关闭")}
              title={bi(locale, "Close (Esc)", "关闭（Esc）")}
              onClick={onClose}
            >
              ✕
            </button>
          ) : (
            <span className="ie-choice-required">
              <span className="ie-muted" data-testid={requiredTestId}>
                {requiredLabel ?? bi(locale, "This choice is required.", "此项为必选。")}
              </span>
              {onCollapse !== undefined && (
                <button
                  type="button"
                  className="ie-btn secondary"
                  data-testid={collapseTestId}
                  title={collapseTitle ?? bi(locale, "Collapse and answer later from the Orders panel", "收起后从指令面板作答")}
                  onClick={onCollapse}
                >
                  {collapseLabel ?? bi(locale, "Collapse", "收起")}
                </button>
              )}
            </span>
          )}
        </header>
        <div className="ie-choice-body">{children}</div>
        {dismissible && footer !== undefined && <footer className="ie-choice-foot">{footer}</footer>}
      </div>
    </div>
  );
};
