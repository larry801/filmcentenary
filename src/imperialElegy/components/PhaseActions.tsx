import React from "react";
import {ConfirmButton} from "./ConfirmButton";
import {readConfirmActions} from "./preferences";

/** One button in the phase-action row (pass, end impulse, ready, …). */
export interface PhaseAction {
  key: string;
  label: string;
  testId?: string;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  /**
   * The button ends something the rules cannot undo (the impulse, the
   * diplomacy step, the war).  It then arms before it fires unless the
   * `confirmActions` preference is off.
   */
  confirm?: boolean;
}

export interface PhaseActionsProps {
  /** Section heading, e.g. "Your impulse". */
  title: string;
  actions: PhaseAction[];
  locale: "en" | "zh_CN";
  /** The live `confirmActions` preference; omitted means "read the stored one". */
  confirmActions?: boolean;
}

/**
 * The buttons that end or continue the current phase step (ready, pass, end
 * impulse, continue).  They live in the pinned decision dock next to the
 * pending decisions: both are "what you may do right now", and a tall map or a
 * long hand must not push either below the fold.
 *
 * `data-testid="ie-impulse-actions"` is kept from the old hand-panel header so
 * the board's "only the acting seat gets these" assertions still apply.
 */
export const PhaseActions = ({title, actions, locale, confirmActions: liveConfirm}: PhaseActionsProps) => {
  // One read per mount: the preference is display-only and cheap to re-read.
  const storedConfirm = React.useMemo(() => readConfirmActions(), []);
  const confirmActions = liveConfirm ?? storedConfirm;
  if (actions.length === 0) return null;
  return (
    <div className="ie-dock-choice" data-testid="ie-phase-actions">
      <div className="ie-section-title">{title}</div>
      <div className="ie-inline" data-testid="ie-impulse-actions">
        {actions.map((action, index) => (
          <ConfirmButton
            key={action.key}
            className={index === 0 ? "ie-btn primary" : "ie-btn"}
            data-testid={action.testId}
            disabled={action.disabled}
            title={action.title}
            confirm={action.confirm === true && confirmActions}
            confirmLabel={`${locale === "zh_CN" ? "确认" : "Confirm"}: ${action.label}`}
            onConfirm={action.onClick}
          >
            {action.label}
          </ConfirmButton>
        ))}
      </div>
    </div>
  );
};
