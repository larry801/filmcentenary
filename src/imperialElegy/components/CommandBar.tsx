import React from "react";
import {DecisionDock} from "./DecisionDock";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";

export interface CommandBarProps {
  /** One-line "what now" text for the dock bar. */
  summary: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  locale: "en" | "zh_CN";
  /** Phase label for the meta line (already localized). */
  phaseLabel: string;
  /** Acting power, already localized. */
  activeLabel: string;
  turn: number;
  /** The single place CP is printed on the board. */
  cp: number | null;
  /** Compact phase buttons (pass / end impulse / ready / continue). */
  actions?: React.ReactNode;
  /** The bulky current-decision body. */
  children?: React.ReactNode;
  /** Display menu (card face, language) pinned to the right. */
  menu?: React.ReactNode;
  /** A spectator with nothing to answer gets the phase/CP line but no dock. */
  dockVisible?: boolean;
  /** Status badges (world tension, pending seat, viewer) kept out of the map. */
  status?: React.ReactNode;
  /** A decision waiting on another seat; overlays the map top without shifting it. */
  notice?: React.ReactNode;
}

/**
 * The 56 px command bar.
 *
 * It answers the three questions an impulse starts with — which phase, whose
 * turn, how much CP is left — and carries the pinned DecisionDock with the
 * buttons that end or answer the step.  `ie-dock` and its test ids stay on the
 * nested dock so the existing control assertions keep working; the CP readout
 * lives here and nowhere else on the board.
 */
export const CommandBar = ({
  summary, collapsed, onToggleCollapsed, locale,
  phaseLabel, activeLabel, turn, cp, actions, children, menu, dockVisible = true, status, notice,
}: CommandBarProps) => {
  const t = ieT();
  return (
    <div className="ie-command-bar" data-testid="ie-command-bar">
      <div className="ie-command-meta">
        <span className="ie-command-phase" data-testid="ie-command-phase">{phaseLabel}</span>
        <span className="ie-command-sep" aria-hidden="true">·</span>
        <span className="ie-command-active" data-testid="ie-command-active">{activeLabel}</span>
        <span className="ie-command-sep" aria-hidden="true">·</span>
        <span className="ie-command-turn">{t.turn} {turn}</span>
        {cp !== null && (
          <span className="ie-command-cp" data-testid="ie-command-cp" title={bi(locale, "CP left this impulse", "本行动轮剩余 CP")}>
            <span className="ie-command-cp-label">{t.cp}</span> <b>{cp}</b>
          </span>
        )}
      </div>
      {status !== undefined && <div className="ie-command-status">{status}</div>}
      {dockVisible ? (
        <DecisionDock
          summary={summary}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
          locale={locale}
          actions={actions}
        >
          {children}
        </DecisionDock>
      ) : <div className="ie-command-spacer"/>}
      {menu !== undefined && <div className="ie-command-menu">{menu}</div>}
      {notice !== undefined && <div className="ie-command-notice">{notice}</div>}
    </div>
  );
};
