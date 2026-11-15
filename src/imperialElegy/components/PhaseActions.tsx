import React from "react";

/** One button in the phase-action row (pass, end impulse, ready, …). */
export interface PhaseAction {
  key: string;
  label: string;
  testId?: string;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}

export interface PhaseActionsProps {
  /** Section heading, e.g. "Your impulse". */
  title: string;
  actions: PhaseAction[];
  locale: "en" | "zh_CN";
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
export const PhaseActions = ({title, actions, locale}: PhaseActionsProps) => {
  if (actions.length === 0) return null;
  return (
    <div className="ie-dock-choice" data-testid="ie-phase-actions">
      <div className="ie-section-title">{title}</div>
      <div className="ie-inline" data-testid="ie-impulse-actions">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className="ie-btn"
            data-testid={action.testId}
            disabled={action.disabled}
            title={action.title}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
