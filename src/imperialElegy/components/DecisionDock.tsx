import React from "react";
import {bi} from "./boardHelpers";

export interface DecisionDockProps {
  /** One-line description of what the dock currently wants from the player. */
  summary: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  locale: "en" | "zh_CN";
  /**
   * Compact always-visible buttons (ready, pass, end impulse, continue).
   * They stay in the bar even when the body is collapsed: ending an impulse
   * must not cost an extra click to expand the panel first.
   */
  actions?: React.ReactNode;
  /** The bulky part: card choices, pending decisions, targeting instructions. */
  children?: React.ReactNode;
}

/**
 * The pinned decision dock.
 *
 * Everything the rules require right now lives here — the pending decision,
 * the required card choices and the buttons that end or continue the step.
 * It is sticky under the app bar so a tall map or a long hand cannot push it
 * out of view, and it collapses to a single bar so it stops covering the map
 * once the player has seen it.
 *
 * The phase buttons stay in the bar while collapsed, so "pass" and "end
 * impulse" are always one click away.
 */
export const DecisionDock = ({
  summary, collapsed, onToggleCollapsed, locale, actions, children,
}: DecisionDockProps) => (
  <div className="ie-dock" data-testid="ie-dock" data-collapsed={collapsed ? "true" : "false"}>
    <div className="ie-dock-bar" role="status" aria-live="polite">
      <span className="ie-dock-bar-summary" data-testid="ie-dock-summary" title={summary}>{summary}</span>
      {actions}
      <button
        type="button"
        className="ie-dock-toggle"
        data-testid="ie-dock-toggle"
        aria-expanded={collapsed ? "false" : "true"}
        onClick={onToggleCollapsed}
      >
        {collapsed ? bi(locale, "Expand", "展开") : bi(locale, "Collapse", "收起")}
      </button>
    </div>
    {!collapsed && (children === undefined || children === null ? null : (
      <div className="ie-dock-body">{children}</div>
    ))}
  </div>
);
