import React from "react";
import {ImperialElegyState, Power} from "../types";
import {GOALS_BY_ID} from "../constant/goals";
import {cardById} from "../engine/deck";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";

/**
 * Card choices the rules require right now: the diplomacy home card, the
 * end-phase National Goal pick, the prep-phase stability discard and the
 * diplomacy card transfer.  They live in the pinned decision dock (see
 * `board.tsx`) instead of the hand panel, because a tall map or a long hand
 * would otherwise push them below the fold.
 */
export interface HandChoicesProps {
  viewer: Power | null;
  me: ImperialElegyState["powers"][Power] | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  phase: string;
  canPhaseAct: boolean;
  hand: string[];
  ngChoices: string[];
  homeCardTitle: (id: string) => string;
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

/** True when at least one required card choice is on screen for this viewer. */
export const hasHandChoices = ({
  phase, canPhaseAct, me, ngChoices, viewer,
}: Pick<HandChoicesProps, "phase" | "canPhaseAct" | "me" | "ngChoices" | "viewer">): boolean => {
  if (viewer === null || me === null) return false;
  return (phase === "diplomacy" && me.homeCards.length > 0) ||
    (phase === "end" && ngChoices.length > 0) ||
    (phase === "prep" && canPhaseAct && !me.flags.prepStability);
};

export const HandChoices = (props: HandChoicesProps) => {
  const {
    viewer, me, locale, t, phase, canPhaseAct, hand, ngChoices, homeCardTitle, doAction, moves,
  } = props;
  if (viewer === null || me === null) return null;

  const showHome = phase === "diplomacy" && me.homeCards.length > 0;
  const showGoals = phase === "end" && ngChoices.length > 0;
  const discardable = hand.filter((id) => {
    const card = cardById(id);
    return card.type !== "mandatory" && card.kind !== "home";
  });
  const showDiscard = phase === "prep" && canPhaseAct && !me.flags.prepStability && discardable.length > 0;
  if (!showHome && !showGoals && !showDiscard) return null;

  return (
    <div className="ie-dock-choices" data-testid="ie-hand-choices">
      {showHome && (
        <div className="ie-dock-choice" data-testid="ie-home-card-choice">
          <div className="ie-section-title">{t.chooseHome}:</div>
          <div className="ie-inline">
            {me.homeCards.map((id) => {
              const chosen = me.selectedHomeCard === id;
              return (
                <button
                  key={id}
                  className={`ie-btn secondary${chosen ? " selected" : ""}`}
                  aria-pressed={chosen}
                  disabled={!canPhaseAct || me.selectedHomeCard !== null}
                  onClick={() => doAction(() => moves.chooseHomeCard(id))}
                >
                  {chosen ? "✓ " : ""}{homeCardTitle(id)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showGoals && (
        <div className="ie-dock-choice" data-testid="ie-goal-choice">
          <div className="ie-section-title">{bi(locale, "Draw three National Goals and keep one", "抽三张国家目标并保留一张")}</div>
          <div className="ie-inline">
            {ngChoices.map((id) => (
              <button key={id} className="ie-btn secondary" onClick={() => doAction(() => moves.chooseGoal(id))}>
                {locale === "zh_CN" ? GOALS_BY_ID[id]?.titleZh : GOALS_BY_ID[id]?.title}
              </button>
            ))}
          </div>
          <div className="ie-hint">{bi(locale, "Continuing without a choice keeps the first Goal.", "未选择即继续时自动保留第一张目标。")}</div>
        </div>
      )}

      {showDiscard && (
        <div className="ie-dock-choice" data-testid="ie-stability-discard">
          <div className="ie-section-title">{t.discardForStability}:</div>
          <div className="ie-inline">
            {discardable.map((id) => (
              <button key={id} className="ie-btn secondary" onClick={() => doAction(() => moves.discardForStability(id))}>{homeCardTitle(id)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
