/**
 * The dock's "what now" lines.
 *
 * The board already printed one summary sentence per step (`dockSummary`), but
 * that sentence names the *rule* — "spend a war-budget CP on an action", "play
 * Exhaustion before passing".  A player who only reads the board still has to
 * guess which control performs it, which is what stalled the solo Historical
 * Great War: the Exhaustion prompt named a card that lives in the hand tray,
 * and the "must act" prompt did not say that an action starts with a space
 * click on the map.
 *
 * Each hint therefore names the **control path** in the order the player walks
 * it — map space, then Orders page, then button — and carries the live number
 * that makes the step checkable (budget, balance, remaining card count).  The
 * list is short by design: the summary above it still carries the rule, and the
 * Order panel carries the rows.
 *
 * Pure and state-in only, so the hints can be tested against hand-built states
 * exactly like the engine's own allowance helpers.
 */
import {ImperialElegyState, Power} from "../types";
import {cpBudgetFor} from "../engine/rules";
import {currentGwImpulse, gwFinishImpulseProblem} from "../engine/gwImpulse";
import {bi} from "./boardHelpers";
import type {ieT} from "./i18n";

export type IELocale = "en" | "zh_CN";
export type Strings = ReturnType<typeof ieT>;

/** One line of the "what now" block. `key` is stable for tests and CSS. */
export interface ActionHint {
  key: string;
  text: string;
}

/**
 * 27.1–27.6, 12.0 and the diplomacy/end steps: the concrete next click.
 *
 * Returns at most two lines — the owed step first, the follow-on second — and
 * never repeats the dock summary, which already names the governing rule.
 */
export const actionHints = (
  G: ImperialElegyState,
  viewer: Power | null,
  locale: IELocale,
  t: Strings,
): ActionHint[] => {
  if (viewer === null || G.result !== null) return [];
  const out: ActionHint[] = [];
  const push = (key: string, en: string, zh: string): void => { out.push({key, text: bi(locale, en, zh)}); };

  if (G.pending !== null) {
    if (G.pending.power !== viewer) return [];
    push("decision",
      "Answer the decision in the dialog over the board — the printed options are the only choices.",
      "在上方对话框中选择一项——只有印刷给出的选项可选。");
    return out;
  }
  if (G.battle !== null) {
    push("battle",
      "Resolve the battle: choose the firepower DRMs and losses in the battle panel, then press its confirm button.",
      "结算战斗：在战斗面板中选择火力 DRM 与损失，再点确认按钮。");
    return out;
  }

  const active = G.activePower === viewer;
  const budget = cpBudgetFor(G, viewer);

  if (G.phase === "gwManeuver" && G.gw) {
    if (G.gw.neutralImpulses) {
      push("gwNeutral",
        "Neutral impulse: play your Great War card's event from the hand tray, or keep it.",
        "中立行动轮：在手牌区把大战卡作为事件打出，或保留卡牌。");
      return out;
    }
    if (!active) return [];
    const problem = gwFinishImpulseProblem(G, viewer);
    const acted = currentGwImpulse(G, viewer).acted === true;
    if (problem === "exhaustion") {
      push("gwExhaustion",
        "Open the hand tray's Great War card and press its event button to play Exhaustion.",
        "打开手牌区的大战卡，点其“打出事件”按钮打出「精疲力竭」。");
      push("gwExhaustionBudget", `War budget ${budget}.`, `战争预算 ${budget}。`);
      return out;
    }
    if (problem === "bonusPending") {
      push("gwBonus",
        "Card bonus: pick a space on the map, then take one non-land-battle action in Orders.",
        "卡牌奖励：在地图上点选一个空间，再在指令面板执行一次非陆战行动。");
      return out;
    }
    if (problem === "mustAct") {
      push("gwAct",
        "Pick a space with your armies on the map, then take one action on the Orders page: march, rail, draft, refit or deploy.",
        "在地图上点选己方军团所在空间，再在指令面板「行动」页执行一次：行军、铁路、征召、整补或部署。");
      push("gwActBudget",
        `War budget ${budget}; an impulse may pass only at 2 or less.`,
        `战争预算 ${budget}；预算 ≤2 才能停牌。`);
      return out;
    }
    if (acted) {
      push("gwDone",
        "This impulse's action is complete — press “End impulse”. A GW card may still fund one bonus action.",
        "本行动轮的行动已完成——点「结束行动轮」。大战卡仍可再资助一次奖励行动。");
      return out;
    }
    push("gwPass",
      `Press “Pass” to skip this impulse (war budget ${budget}).`,
      `点「大战停牌」跳过本行动轮（战争预算 ${budget}）。`);
    return out;
  }

  if (G.phase === "gwPlanning") {
    push("gwPlanning",
      "Planning: your Great War card is dealt to the hand tray. Transfer 1 CP to an ally or reveal a combat card if you wish, then press “Start maneuver”.",
      "计划阶段：大战卡已发到手牌区。可向盟友转交 1 点预算或公开阵前战斗牌，然后点「开始机动」。");
    return out;
  }

  if (G.phase === "gwWinter") {
    push("gwWinter",
      "Winter resolves on its own: blockade, colonial war, then the next GW turn.",
      "冬季自动结算：封锁、殖民战争，然后进入下一个大战回合。");
    return out;
  }

  if (G.phase === "action" && active) {
    if (G.cpRemaining <= 0) {
      push("actionPlayCard",
        "Play a card from the hand tray for its CP (or event) to open this impulse.",
        "从手牌区打出一张牌换取 CP（或打出事件）开始本次行动。");
    } else {
      push("actionSpendCp",
        `Spend the ${G.cpRemaining} CP left: pick a space on the map, then an action in Orders.`,
        `使用剩余 ${G.cpRemaining} 点 CP：在地图上点选空间，再在指令面板选择行动。`);
    }
    return out;
  }

  if (G.phase === "diplomacy") {
    push("diplomacy",
      "Negotiate on the Deals page, then every seat presses “Finish negotiating”; the home-card choice opens after that.",
      "在「谈判」页与各方交涉，然后所有席位点「结束谈判」；之后开放本土牌选择。");
    return out;
  }

  return out;
};
