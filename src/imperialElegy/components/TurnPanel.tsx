/**
 * The turn panel: the 348 px column right of the map.
 *
 * Head: the single CP readout used on phones and the phase buttons.  Tabs:
 * Orders, War (only while a war or the Great War is running) and Log.
 *
 * A pending decision or an open battle replaces the Orders body, so the panel
 * never covers map targets: `canAct` already requires `pending === null` and a
 * battle target is chosen on the map through the mode pill.  The panel keeps
 * the historic `ie-dock`/`ie-dock-summary`/`ie-pending`/`ie-command-cp` ids so
 * the control suite and the static-markup suites keep their anchors.
 */
import React from "react";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";
import type {PhaseAction} from "./PhaseActions";
import {PhaseActions} from "./PhaseActions";
import {useRovingTabs} from "./useRovingTabs";

export interface TurnPanelProps {
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  /** CP left this impulse (the head readout, `ie-command-cp`). */
  cp: number;
  phaseActions: PhaseAction[];
  phaseLabel: string;
  activeLabel: string;
  turn: number;
  /** One-line "what now". */
  summary: string;
  warVisible: boolean;
  /** A decision or battle is open, so Orders shows it instead of actions. */
  hasDecision: boolean;
  decisionBadge?: boolean;
  warBadge?: React.ReactNode;
  tabs: {
    action: React.ReactNode;
    war: React.ReactNode;
    log: React.ReactNode;
  };
  /** Tab driven from the board (the track strip's references, testing). */
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const TurnPanel = ({
  locale, t, cp, phaseActions, phaseLabel, activeLabel, turn, summary, warVisible, hasDecision,
  decisionBadge = false, warBadge, tabs, activeTab, onTabChange,
}: TurnPanelProps) => {
  const [internal, setInternal] = React.useState("action");
  const active = activeTab ?? internal;
  const choose = (key: string) => {
    if (onTabChange) onTabChange(key);
    else setInternal(key);
  };
  // A war tab that disappears while selected must not leave the panel empty.
  const keys = warVisible ? ["action", "war", "log"] : ["action", "log"];
  const selected = keys.includes(active) ? active : "action";
  const roving = useRovingTabs(keys, selected, choose);

  const labels: Record<string, string> = {
    action: hasDecision ? bi(locale, "Decision", "决策") : bi(locale, "Orders", "指令"),
    war: bi(locale, "War", "战局"),
    log: bi(locale, "Log", "记录"),
  };

  return (
    <aside className="ie-turn-panel" data-testid="ie-dock" data-collapsed="false" aria-label={bi(locale, "Turn panel", "回合面板")}>
      <div className="ie-dock-bar">
        <span className="ie-dock-bar-summary" data-testid="ie-dock-summary" title={summary}>{summary}</span>
        <span className="ie-command-phase" data-testid="ie-tp-phase">{phaseLabel}</span>
        <span className="ie-command-turn">{t.turn} {turn}</span>
        <span className="ie-command-active">{activeLabel}</span>
      </div>

      <div className="ie-turn-head">
        <span className="ie-command-cp" data-testid="ie-command-cp" title={bi(locale, "CP left this impulse", "本行动轮剩余 CP")}>
          <span className="ie-command-cp-label">{t.cp}</span> <b>{cp}</b>
        </span>
        {/* The one exit of an impulse (12.0) lives in the panel head next to
            the CP readout; the strip above only reports the position. */}
        <PhaseActions title={t.yourTurnActions} locale={locale} actions={phaseActions}/>
      </div>

      <div className="ie-turn-tabs" role="tablist" aria-label={bi(locale, "Turn panel sections", "回合面板分页")}>
        {keys.map((key) => {
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`ie-turn-tab-${key}`}
              aria-selected={isSelected}
              aria-controls={`ie-turn-panel-${key}`}
              className={`ie-turn-tab${key === "action" && hasDecision ? " urgent" : ""}`}
              data-testid={`ie-turn-tab-${key}`}
              {...roving(key)}
              onClick={() => choose(key)}
            >
              {labels[key]}
              {key === "action" && decisionBadge && <span className="ie-turn-tab-badge" aria-label={bi(locale, "Your decision", "你的决策")}>!</span>}
              {key === "war" && warBadge !== undefined && <span className="ie-turn-tab-badge">{warBadge}</span>}
            </button>
          );
        })}
      </div>

      {keys.map((key) => (
        <div
          key={key}
          id={`ie-turn-panel-${key}`}
          role="tabpanel"
          aria-labelledby={`ie-turn-tab-${key}`}
          className="ie-turn-body"
          data-testid={`ie-turn-panel-${key}`}
          hidden={key !== selected}
          // Inactive bodies stay mounted (hidden) so their derived state and
          // the bots' effects never depend on the open tab.
        >
          {tabs[key as "action" | "war" | "log"]}
        </div>
      ))}
    </aside>
  );
};
