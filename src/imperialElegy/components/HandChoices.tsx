import React from "react";
import {ImperialElegyState, Power} from "../types";
import {GOALS_BY_ID} from "../constant/goals";
import {cardById} from "../engine/deck";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";
import {CardChoice} from "./CardChoice";

/**
 * Card choices the rules require right now: the diplomacy home card, the
 * end-phase National Goal pick, the prep-phase stability discard and the
 * diplomacy card transfer.  They live in the pinned decision dock (see
 * `board.tsx`) instead of the hand panel, because a tall map or a long hand
 * would otherwise push them below the fold.
 *
 * Every option renders its printed face, not just a title button: the choice
 * is "which card", so the player needs the card's rules in front of them.
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
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

/** Which kinds of card choice the rules put on screen right now. */
export interface HandChoiceAvailability {
  /** A rules-mandated choice is waiting (home card, National Goal). */
  required: boolean;
  /** An action the player may take but may also skip (stability discard). */
  optional: boolean;
}

/**
 * Split the card choices into mandatory and optional.  The distinction matters
 * for the dock: a required choice is a blocker, while an optional one must not
 * read as "you cannot continue until you pick".
 */
export const handChoiceAvailability = ({
  phase, canPhaseAct, me, ngChoices, viewer, hand,
}: Pick<HandChoicesProps, "phase" | "canPhaseAct" | "me" | "ngChoices" | "viewer" | "hand">): HandChoiceAvailability => {
  if (viewer === null || me === null) return {required: false, optional: false};
  const home = phase === "diplomacy" && me.homeCards.length > 0 && me.selectedHomeCard === null;
  const goals = phase === "end" && ngChoices.length > 0;
  // The discard needs a legal card in hand; otherwise the dock would announce a
  // choice with an empty body.
  const discard = phase === "prep" && canPhaseAct && !me.flags.prepStability &&
    hand.some((id) => isDiscardableForStability(id));
  return {required: home || goals, optional: discard};
};

/** Cards the prep stability discard may spend (11.x: not mandatory, not a home card). */
export const isDiscardableForStability = (id: string): boolean => {
  const card = cardById(id);
  return card.type !== "mandatory" && card.kind !== "home";
};

/** True when at least one card choice is on screen for this viewer. */
export const hasHandChoices = (props: Parameters<typeof handChoiceAvailability>[0]): boolean => {
  const {required, optional} = handChoiceAvailability(props);
  return required || optional;
};

export const HandChoices = (props: HandChoicesProps) => {
  const {
    viewer, me, locale, t, phase, canPhaseAct, hand, ngChoices, doAction, moves,
  } = props;
  if (viewer === null || me === null) return null;

  // Once the card is chosen the faces stay (they mark the selection) but the
  // dock no longer treats the step as an open required choice.
  const showHome = phase === "diplomacy" && me.homeCards.length > 0;
  const showGoals = phase === "end" && ngChoices.length > 0;
  const discardable = hand.filter(isDiscardableForStability);
  const showDiscard = phase === "prep" && canPhaseAct && !me.flags.prepStability && discardable.length > 0;
  if (!showHome && !showGoals && !showDiscard) return null;

  const chooseLabel = bi(locale, "Choose", "选择");
  const discardLabel = bi(locale, "Discard for +1 stability", "弃牌换 +1 稳定");
  // Only the prep discard may be skipped; the home card and the National Goal
  // are mandatory, so their sections carry no "optional" wording.
  const optionalTag = bi(locale, "Optional", "可选");

  return (
    <div className="ie-dock-choices" data-testid="ie-hand-choices">
      {showHome && (
        <div className="ie-dock-choice" data-testid="ie-home-card-choice">
          <div className="ie-section-title">{t.chooseHome}:</div>
          <div className="ie-choice-grid">
            {me.homeCards.map((id) => {
              const chosen = me.selectedHomeCard === id;
              return (
                <CardChoice
                  key={id}
                  locale={locale}
                  face={{card: cardById(id)}}
                  testId={`ie-home-card-${id}`}
                  actions={[{
                    label: chosen ? bi(locale, "Chosen", "已选择") : chooseLabel,
                    testId: `ie-choose-home-${id}`,
                    selected: chosen,
                    disabled: !canPhaseAct || me.selectedHomeCard !== null,
                    onChoose: () => doAction(() => moves.chooseHomeCard(id)),
                  }]}
                />
              );
            })}
          </div>
        </div>
      )}

      {showGoals && (
        <div className="ie-dock-choice" data-testid="ie-goal-choice">
          <div className="ie-section-title">{bi(locale, "Draw three National Goals and keep one", "抽三张国家目标并保留一张")}</div>
          <div className="ie-choice-grid">
            {ngChoices.map((id) => {
              const goal = GOALS_BY_ID[id];
              return goal ? (
                <CardChoice
                  key={id}
                  locale={locale}
                  face={{goal}}
                  testId={`ie-ng-card-${id}`}
                  actions={[{
                    label: bi(locale, "Keep this Goal", "保留此目标"),
                    testId: `ie-choose-goal-${id}`,
                    onChoose: () => doAction(() => moves.chooseGoal(id)),
                  }]}
                />
              ) : (
                <button key={id} className="ie-btn secondary" onClick={() => doAction(() => moves.chooseGoal(id))}>
                  {id}
                </button>
              );
            })}
          </div>
          <div className="ie-hint">{bi(locale, "Continuing without a choice keeps the first Goal.", "未选择即继续时自动保留第一张目标。")}</div>
        </div>
      )}

      {showDiscard && (
        <div className="ie-dock-choice ie-dock-choice-optional" data-testid="ie-stability-discard">
          <div className="ie-section-title">
            {t.discardForStability}
            <span className="ie-choice-tag" data-testid="ie-stability-discard-optional">{optionalTag}</span>
          </div>
          <div className="ie-choice-grid">
            {discardable.map((id) => (
              <CardChoice
                key={id}
                locale={locale}
                face={{card: cardById(id)}}
                testId={`ie-discard-card-${id}`}
                actions={[{
                  label: discardLabel,
                  testId: `ie-discard-${id}`,
                  onChoose: () => doAction(() => moves.discardForStability(id)),
                }]}
              />
            ))}
          </div>
          {/* Skipping is a legal choice: the player can keep the card and
              simply press Ready / continue. */}
          <div className="ie-hint" data-testid="ie-stability-discard-hint">
            {bi(locale,
              "Optional: you may skip this and keep the card — press Ready (准备完毕) to continue without discarding.",
              "可选：可以跳过并保留手牌——直接点“准备完毕”继续即可，无需弃牌。")}
          </div>
        </div>
      )}
    </div>
  );
};
