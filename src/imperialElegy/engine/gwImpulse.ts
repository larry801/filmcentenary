/** Printed 27.1–27.3 allowances. No action may invent a second budget spend. */
import {GwActionKind, GwImpulseState, ImperialElegyState, Power, POWERS} from "../types";
import {cpBudgetFor, gwAllyImpulseFor, spendCpFor} from "./rules";
import {facedownGwCombatCards} from "./combatCards";
import {EXHAUSTION_CARD, superiorStaffWorkGwFreeDeploy} from "./characteristics";
import {italyEntryAvailable} from "./gwMajors";

/**
 * The live 27.1 one-action ledger only exists once `beginGwImpulse` has run for
 * the current impulse. Older saves (and states assembled directly by rule
 * tests) have no ledger yet: keep the pre-27.1 CP-wallet validation until the
 * next activation creates one, so resuming an old save never suddenly rejects
 * its in-flight action. `currentGwImpulse` already reconstructs a conservative
 * ledger from `gwActionsThisImpulse` for such saves; this is the matching gate
 * for the new strictness itself.
 */
export const hasLiveGwImpulse = (G: ImperialElegyState): boolean =>
  G.gw?.impulse !== undefined;

export const currentGwImpulse = (G: ImperialElegyState, power: Power): GwImpulseState => {
  const saved = G.gw?.impulse;
  if (saved?.power === power && saved.turn === G.gw?.turn && saved.index === G.turnIndex) return saved;
  // Older saves recorded a count, but not an action kind. Conservatively keep
  // the spent ordinary action; the next activation creates the complete ledger.
  const acted = Number(G.powers[power].flags.gwActionsThisImpulse ?? 0) > 0;
  return {
    power, turn: G.gw?.turn ?? 0, index: G.turnIndex, serial: G.gw?.impulseSeq ?? 0,
    acted, ...(acted ? {budgetAction: "legacy" as const} : {}),
  };
};

/** Identify the current GW impulse so a one-per-impulse event stays spent. */
export const gwImpulseKey = (G: ImperialElegyState): string =>
  G.gw?.impulseSeq === undefined
    ? `${G.gw?.turn ?? 0}:${G.turnIndex}:${G.activePower}`
    : `${G.gw.turn}:impulse${G.gw.impulseSeq}:${G.activePower}`;

/**
 * GW-05 "Capable Commander" may be played as a normal event at the start of a
 * player's GW impulse to flip a facedown GW combat card.  Its battle reroll
 * mode is handled by `combat.ts` and never reaches this gate.
 */
export const canPlayGw05Event = (G: ImperialElegyState, power: Power): boolean => {
  if (G.phase !== "gwManeuver" || G.gw?.active !== true) return false;
  if (G.activePower !== power) return false;
  if (G.pending !== null || G.battle !== null) return false;
  if (Number(G.powers[power].flags.gwActionsThisImpulse ?? 0) !== 0) return false;
  if (G.flags.gw05PlayedImpulse === gwImpulseKey(G)) return false;
  return facedownGwCombatCards(G).length > 0;
};

/**
 * GW #2 is printed "cannot be played on GW turn 0".  Its one turn-0 offer is
 * the outbreak Italy that stayed out (25.3), and a single copy of the card can
 * use that offer once.  This mirrors `majorEntryOptions(...).includes("IT")`,
 * which the move re-checks, for a power that is actually on a side.
 */
const gw02EventOpen = (G: ImperialElegyState, power: Power): boolean => {
  if ((G.gw?.turn ?? 0) > 0) return true;
  const onSide = G.gw?.te.includes(power) === true || G.gw?.ta.includes(power) === true;
  return onSide && G.flags.gwMajorEntryOutbreak !== true && italyEntryAvailable(G);
};

export const beginGwImpulse = (G: ImperialElegyState, power: Power): void => {
  if (!G.gw) return;
  G.gw.impulseSeq = (G.gw.impulseSeq ?? 0) + 1;
  G.gw.impulse = {
    power, turn: G.gw.turn, index: G.turnIndex, serial: G.gw.impulseSeq, acted: false,
  };
  G.powers[power].flags.gwActionsThisImpulse = 0;
};

export type GwImpulseReason = "busy" | "notActive" | "notBelligerent" | "budget" |
  "actionUsed" | "repeatAction" | "bonusLandBattle" | "bonusPending" | "exhaustion" |
  "mustAct" | "cardWindow" | "battleCard" | "majorCard";
export type GwActionAllowance = {ok: true; funding: "budget" | "card" | "staff" | "legacy"; cost: number} |
  {ok: false; reason: GwImpulseReason};

export const gwActionAllowance = (G: ImperialElegyState, power: Power, kind: GwActionKind): GwActionAllowance => {
  if (!hasLiveGwImpulse(G)) {
    // Pre-27.1 states: one CP per action against the generic wallet, with no
    // action-identity limit. The free 33.1 staff deploy stays outside it.
    if (G.phase !== "gwManeuver") return {ok: false, reason: "busy"};
    if (kind === "deploy" && gwAllyImpulseFor(G, power) === null && superiorStaffWorkGwFreeDeploy(G)) {
      return {ok: true, funding: "staff", cost: 0};
    }
    if (cpBudgetFor(G, power) < 1) return {ok: false, reason: "budget"};
    return {ok: true, funding: "legacy", cost: 1};
  }
  if (!G.gw?.active || G.phase !== "gwManeuver" || G.activePower !== power || G.powers[power].eliminated) {
    return {ok: false, reason: "notActive"};
  }
  if (G.pending || G.battle) return {ok: false, reason: "busy"};
  if (!G.gw.belligerents.includes(power) || G.gw.neutralImpulses) return {ok: false, reason: "notBelligerent"};
  const impulse = currentGwImpulse(G, power);
  const major = gwAllyImpulseFor(G, power);
  // 33.1 free deploy is outside both the ordinary and card action allowances.
  if (kind === "deploy" && major === null && superiorStaffWorkGwFreeDeploy(G)) {
    return {ok: true, funding: "staff", cost: 0};
  }
  const cardBonus = impulse.bonusPending || impulse.bonusAction !== undefined;
  if (cardBonus && kind === "landBattle") return {ok: false, reason: "bonusLandBattle"};
  if (cardBonus && (kind === impulse.budgetAction || kind === impulse.bonusAction)) {
    return {ok: false, reason: "repeatAction"};
  }
  if (impulse.bonusPending) return {ok: true, funding: "card", cost: 0};
  if (impulse.budgetAction !== undefined) return {ok: false, reason: "actionUsed"};
  if (cpBudgetFor(G, power) < 1) return {ok: false, reason: "budget"};
  // Don't spend the last ordinary CP before mandatory Exhaustion can be played.
  if (major === null && G.powers[power].gwCard === EXHAUSTION_CARD && cpBudgetFor(G, power) === 1) {
    return {ok: false, reason: "exhaustion"};
  }
  return {ok: true, funding: "budget", cost: 1};
};

/** Called only after the entire action has validated, using its pre-action allowance. */
export const recordGwAction = (
  G: ImperialElegyState, power: Power, kind: GwActionKind,
  allowance: Extract<GwActionAllowance, {ok: true}>,
): void => {
  if (allowance.funding === "legacy") {
    // No ledger to update: charge the wallet and keep the legacy action count,
    // which `currentGwImpulse` will read if the save is resumed. 27.7's
    // consecutive-pass reset still applies to an action, so ending such an
    // impulse is never recorded as a pass.
    spendCpFor(G, power, 1);
    G.powers[power].flags.gwActionsThisImpulse = Number(G.powers[power].flags.gwActionsThisImpulse ?? 0) + 1;
    for (const p of POWERS) G.powers[p].flags.passedGw = false;
    return;
  }
  const impulse = currentGwImpulse(G, power);
  if (allowance.funding === "budget") {
    spendCpFor(G, power, 1);
    impulse.budgetAction = kind;
  } else if (allowance.funding === "card") {
    impulse.bonusPending = false;
    impulse.bonusAction = kind;
    // 27.2: a card spent for its bonus funds one immediate action.  That action
    // settles the `bonusPending` a post-dice response card records, which is
    // what used to leave the impulse "waiting for the bonus" forever: the pass
    // guard refused, so a seat whose only legal exit was the pass could not
    // leave its impulse (found by the 24-seed self-play batch).
    impulse.cardPlayed = true;
    impulse.acted = true;
  } else G.powers.GE.flags.superiorStaffWorkGwUsed = true;
  impulse.acted = true;
  G.gw!.impulse = impulse;
  G.powers[power].flags.gwActionsThisImpulse = Number(G.powers[power].flags.gwActionsThisImpulse ?? 0) + 1;
  // 27.7 means consecutive passes, not permanent withdrawal for the year.
  for (const p of POWERS) G.powers[p].flags.passedGw = false;
  G.gw!.majorPassed = {};
};

/** The same button ends a completed action impulse or passes an unused one. */
export const gwFinishImpulseProblem = (G: ImperialElegyState, power: Power): GwImpulseReason | null => {
  if (!hasLiveGwImpulse(G)) {
    if (!G.gw?.active || G.phase !== "gwManeuver" || G.activePower !== power || G.powers[power].eliminated) return "notActive";
    if (G.pending !== null || G.battle !== null) return "busy";
    return null;
  }
  if (!G.gw?.active || G.phase !== "gwManeuver" || G.activePower !== power || G.powers[power].eliminated) return "notActive";
  if (G.pending || G.battle) return "busy";
  if (G.gw.neutralImpulses) return null;
  if (!G.gw.belligerents.includes(power)) return "notBelligerent";
  const impulse = currentGwImpulse(G, power);
  if (impulse.bonusPending) return "bonusPending";
  const major = gwAllyImpulseFor(G, power);
  if (major === null && G.powers[power].gwCard === EXHAUSTION_CARD && !impulse.budgetAction) return "exhaustion";
  if (impulse.budgetAction) return null;
  // A card action is additional to a budget action, never a substitute for it.
  if (impulse.cardPlayed && cpBudgetFor(G, power) > 0) return "mustAct";
  if (G.gw.order[G.turnIndex] === "bonus") return null;
  return cpBudgetFor(G, power) > 2 ? "mustAct" : null;
};

export const gwMilitaryFinished = (G: ImperialElegyState): boolean => {
  const gw = G.gw;
  if (!gw?.active) return false;
  const players = gw.belligerents.filter((p) => !G.powers[p].eliminated);
  const majors = (["US", "IT"] as const).filter((m) => m === "US" ? gw.usIn : gw.italyIn);
  const budget = (m: "US" | "IT") => m === "US" ? gw.usBudget : gw.italyBudget;
  if (players.some((p) => G.powers[p].gwCard === EXHAUSTION_CARD)) return false;
  return (
    players.every((p) => (G.powers[p].gwBudget ?? 0) <= 0) && majors.every((m) => budget(m) <= 0)
  ) || (
    players.every((p) => (G.powers[p].gwBudget ?? 0) <= 0 || G.powers[p].flags.passedGw === true) &&
    majors.every((m) => budget(m) <= 0 || gw.majorPassed?.[m] === true)
  );
};

export const gwCanEndTurn = (G: ImperialElegyState, power: Power): boolean => {
  // No legacy short-circuit: `gwMilitaryFinished` reads budgets and passes,
  // not the ledger, so a player may never skip another's remaining impulses.
  if (gwFinishImpulseProblem(G, power) !== null || G.gw?.neutralImpulses || !gwMilitaryFinished(G)) return false;
  const gw = G.gw!;
  const empty = gw.belligerents.every((p) => G.powers[p].eliminated || (G.powers[p].gwBudget ?? 0) <= 0) &&
    (!gw.usIn || gw.usBudget <= 0) && (!gw.italyIn || gw.italyBudget <= 0);
  // Let gwPass visit the remaining optional bonus slots before winter.
  return empty || !gw.order.slice(G.turnIndex + 1).includes("bonus");
};

/** Normal events follow the ordinary action; card CP funds a separate immediate action. */
export const gwCardProblem = (G: ImperialElegyState, power: Power, mode: "event" | "cp"): GwImpulseReason | null => {
  const cardId = G.powers[power].gwCard;
  /** Card-specific event windows the move re-checks; keep the UI in step. */
  const eventProblem = (): GwImpulseReason | null => {
    if (cardId === "IE-GW-02" && !gw02EventOpen(G, power)) return "cardWindow";
    if (cardId === "IE-GW-05" && !canPlayGw05Event(G, power)) return "cardWindow";
    return null;
  };
  if (!hasLiveGwImpulse(G)) {
    // Pre-27.1 validation: a GW card may be played in planning or maneuver,
    // and only an open pending decision blocks it.
    if (G.phase !== "gwPlanning" && G.phase !== "gwManeuver") return "cardWindow";
    if (G.pending !== null) return "busy";
    return mode === "event" ? eventProblem() : null;
  }
  if (!G.gw?.active || G.phase !== "gwManeuver" || G.activePower !== power || G.powers[power].eliminated) return "notActive";
  if (G.pending || G.battle) return "busy";
  if (gwAllyImpulseFor(G, power)) return "majorCard";
  const id = cardId;
  const impulse = currentGwImpulse(G, power);
  if (!id || impulse.cardPlayed || impulse.bonusPending) return "cardWindow";
  if (G.gw.neutralImpulses) {
    if (mode === "cp" || ["IE-GW-03", "IE-GW-04", "IE-GW-06"].includes(id)) return "battleCard";
    return mode === "event" ? eventProblem() : null;
  }
  if (!G.gw.belligerents.includes(power)) return "notBelligerent";
  if (mode === "cp" || id === EXHAUSTION_CARD) {
    if (impulse.budgetAction === "legacy") return "cardWindow";
    if (impulse.budgetAction === "landBattle") return "bonusLandBattle";
    return impulse.budgetAction || cpBudgetFor(G, power) > 0 ? null : "budget";
  }
  if (["IE-GW-03", "IE-GW-04", "IE-GW-06"].includes(id)) return "battleCard";
  const special = eventProblem();
  if (special !== null) return special;
  // GW-05 is the printed start-of-impulse response exception.
  if (id === "IE-GW-05") return impulse.acted ? "cardWindow" : null;
  return impulse.budgetAction ? null : "mustAct";
};

export const noteGwCard = (G: ImperialElegyState, power: Power, bonus: boolean): void => {
  // Without a live ledger there is nothing to record; creating one here would
  // switch the in-flight legacy impulse to the new action-identity rules.
  if (!hasLiveGwImpulse(G)) return;
  const impulse = currentGwImpulse(G, power);
  impulse.cardPlayed = true;
  impulse.bonusPending = bonus;
  G.gw!.impulse = impulse;
};
