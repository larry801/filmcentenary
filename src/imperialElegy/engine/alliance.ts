/**
 * Imperial Elegy — the Alliance Track (rules 8.0–8.6).
 *
 * The Alliance Track has five boxes, from the Triple Alliance committed box
 * through neutral to the Triple Entente committed box:
 *
 *   taCommitted — taAligned — neutral — teAligned — teCommitted
 *
 * Rule 8.4: "Only three player powers can ever be in an alliance."  Every live
 * path that moves a player's chit into an alliance box must go through this
 * module so the cap is enforced in one place:
 *  - `shiftAlliance` moves a chit one box at a time and refuses a step that
 *    would put a fourth player into an alliance;
 *  - `allianceAtCapacity`/`canJoinAlliance` are the predicates used by the
 *    alliance-resolution step, event-driven shifts and the GW neutral entry.
 *
 * Rule 8.4's printed exception is that a defender forced to shift after a
 * declaration of war may join an alliance that already has three players.  The
 * only live path that uses it is `declarationShift` below, called by
 * `moves.ts#declareWar` (8.2) and its both-neutral choice move.  Italy and the
 * US are not player powers (8.4 "Important: Italy is not a player power and
 * hence they are not subject to this rule"), so their GW entries never call
 * these helpers.
 */

import {AllianceBox, ImperialElegyState, Power, POWERS} from "../types";
import {italyAllianceBox, shiftItalyToward} from "./italyEntry";

/** The five Alliance Track boxes, ordered from the Triple Alliance to the Entente. */
export const ALLIANCE_TRACK: readonly AllianceBox[] = [
  "taCommitted",
  "taAligned",
  "neutral",
  "teAligned",
  "teCommitted",
] as const;

/** The printed limit: three player powers per alliance (rule 8.4). */
export const ALLIANCE_MAX_PLAYERS = 3;

export type AllianceSide = "te" | "ta";

/** The alliance a box belongs to, or null for the neutral box. */
export const sideOfAllianceBox = (box: AllianceBox): AllianceSide | null => {
  if (box === "teAligned" || box === "teCommitted") return "te";
  if (box === "taAligned" || box === "taCommitted") return "ta";
  return null;
};

/** True when `box` is one of the two committed boxes. */
export const isCommittedAllianceBox = (box: AllianceBox): boolean =>
  box === "teCommitted" || box === "taCommitted";

/**
 * Player powers currently in `side`'s alliance (aligned or committed).
 * Non-player majors (unified Italy, the US) are deliberately not players and
 * are not counted (rule 8.4).
 */
export const allianceMembers = (G: ImperialElegyState, side: AllianceSide): Power[] =>
  POWERS.filter((power) => sideOfAllianceBox(G.powers[power].alliance) === side);

/**
 * Rule 8.4: the alliance already has its three player powers.
 *
 * `except` lets a caller ask "can this power join without counting itself?"
 * (a power already in the alliance moving from aligned to committed must not be
 * blocked by its own presence).
 */
export const allianceAtCapacity = (
  G: ImperialElegyState,
  side: AllianceSide,
  except: Power | null = null,
): boolean => allianceMembers(G, side).filter((power) => power !== except).length >= ALLIANCE_MAX_PLAYERS;

/**
 * Rule 8.4: may `power` be in `side`'s alliance?  A power already on that side
 * may always move within it; a power outside it may only join while fewer than
 * three player powers are members.
 */
export const canJoinAlliance = (G: ImperialElegyState, power: Power, side: AllianceSide): boolean => {
  if (sideOfAllianceBox(G.powers[power].alliance) === side) return true;
  return !allianceAtCapacity(G, side, power);
};

/** The box one step toward `direction` from `box` (a direction of "neutral" walks to the centre). */
export const stepAllianceBox = (box: AllianceBox, direction: AllianceSide | "neutral"): AllianceBox => {
  const index = ALLIANCE_TRACK.indexOf(box);
  if (index < 0) return box;
  if (direction === "neutral") {
    if (index === 2) return box;
    return ALLIANCE_TRACK[index + (index < 2 ? 1 : -1)];
  }
  if (direction === "te") return ALLIANCE_TRACK[Math.min(ALLIANCE_TRACK.length - 1, index + 1)];
  return ALLIANCE_TRACK[Math.max(0, index - 1)];
};

export interface AllianceShiftResult {
  /** The box the chit started in. */
  from: AllianceBox;
  /** The box the chit ended in. */
  to: AllianceBox;
  /** How many boxes were actually shifted. */
  steps: number;
  /**
   * True when a printed shift was refused because it would have put a fourth
   * player into an alliance (rule 8.4).  The chit stays where it was.
   */
  blocked: boolean;
}

export interface AllianceShiftOptions {
  /**
   * Rule 8.4's printed exception: "when a defender is forced to shift after a
   * declaration of war, the defender can shift into an alliance that already
   * has three players."  Only the 8.2 declaration shift may set this; every
   * voluntary shift keeps the cap.
   */
  ignoreCap?: boolean;
}

/**
 * Move `power`'s chit up to `steps` boxes toward `direction`, refusing any
 * step into a full alliance.  This is the single application helper for rule
 * 8.4: the alliance-resolution step, the Shifting Alliances/Alliance System
 * events and the card specials all call it instead of assigning `p.alliance`
 * directly.
 *
 * A shift toward neutrality is never capped.  A shift toward an alliance is
 * checked at every step, so a double shift from the other aligned box stops at
 * neutral when the target alliance already has three players (8.6.1).
 * `options.ignoreCap` is reserved for the printed 8.4 declaration exception.
 */
export const shiftAlliance = (
  G: ImperialElegyState,
  power: Power,
  direction: AllianceSide | "neutral",
  steps = 1,
  options: AllianceShiftOptions = {},
): AllianceShiftResult => {
  const p = G.powers[power];
  const from = p.alliance;
  let current = from;
  let applied = 0;
  let blocked = false;
  for (let i = 0; i < Math.max(0, steps); i += 1) {
    const next = stepAllianceBox(current, direction);
    if (next === current) break;
    const side = sideOfAllianceBox(next);
    if (side !== null && options.ignoreCap !== true && !canJoinAlliance(G, power, side)) {
      blocked = true;
      break;
    }
    current = next;
    applied += 1;
  }
  p.alliance = current;
  return {from, to: current, steps: applied, blocked};
};

/**
 * Put a player's chit directly in `box`, refusing a fourth player in an
 * alliance.  Used where the printed effect names a destination box rather than
 * a direction (a crisis-table result, a treaty realignment).
 */
export const setAlliance = (G: ImperialElegyState, power: Power, box: AllianceBox): boolean => {
  const side = sideOfAllianceBox(box);
  if (side !== null && !canJoinAlliance(G, power, side)) return false;
  G.powers[power].alliance = box;
  return true;
};

// ---------------------------------------------------------------------------
// Rule 8.2 — the declaration-driven defender shift
// ---------------------------------------------------------------------------

/**
 * Rule 8.2: "A declaration of war causes the defending power to shift away
 * from the attacker one space on the Alliance Track."
 *
 * The direction is derived from the two chits: a defender to the Triple
 * Entente side of the attacker steps further toward the Triple Entente, and a
 * defender on the Triple Alliance side steps further toward the Triple
 * Alliance.  The neutral box is the middle, so a neutral defender attacked by
 * an aligned power steps to the *opposite* alliance's aligned box.
 *
 * Returns null when both chits are in the same box.  The printed rule only
 * allows the players to share a box in the neutral box (8.1.2 forbids
 * declaring war on an alliance member), where "the defending power chooses
 * which alliance box to shift into" — the caller must ask the defender.
 */
export const declarationShiftDirection = (
  attackerBox: AllianceBox,
  defenderBox: AllianceBox,
): AllianceSide | null => {
  const attacker = ALLIANCE_TRACK.indexOf(attackerBox);
  const defender = ALLIANCE_TRACK.indexOf(defenderBox);
  if (attacker < 0 || defender < 0 || attacker === defender) return null;
  return defender > attacker ? "te" : "ta";
};

/** The alliance box one 8.2 step toward `side` from `box`, without the cap check. */
export const declarationShiftDestination = (box: AllianceBox, side: AllianceSide): AllianceBox =>
  stepAllianceBox(box, side);

export interface DeclarationShiftResult {
  /** The defender whose chit moved. */
  power: Power;
  from: AllianceBox;
  /** Destination box, or null while the both-neutral choice is still open. */
  to: AllianceBox | null;
  steps: number;
  /** True when rule 8.4's declaration exception let the chit enter a full alliance. */
  forced: boolean;
  /** True when both chits were neutral and the defender must choose the box. */
  needsChoice: boolean;
}

/**
 * Rule 8.2 / 14.2 — one declaration-driven shift for the defender, using rule
 * 8.4's printed exception ("when a defender is forced to shift after a
 * declaration of war, the defender can shift into an alliance that already has
 * three players").
 *
 * `side` is required only for the both-neutral case (the defender's choice);
 * when it is omitted and the chits share the neutral box the helper reports
 * `needsChoice` and leaves the chit untouched so the caller can ask the
 * defender.  No die is rolled and no state other than the chit is touched.
 */
export const declarationShift = (
  G: ImperialElegyState,
  attacker: Power,
  defender: Power,
  side?: AllianceSide,
): DeclarationShiftResult => {
  const attackerBox = G.powers[attacker].alliance;
  const defenderBox = G.powers[defender].alliance;
  const derived = declarationShiftDirection(attackerBox, defenderBox);
  const direction = derived ?? side ?? null;
  if (direction === null) {
    return {
      power: defender,
      from: defenderBox,
      to: null,
      steps: 0,
      forced: false,
      needsChoice: true,
    };
  }
  const destination = declarationShiftDestination(defenderBox, direction);
  const sideOfDestination = sideOfAllianceBox(destination);
  const forced =
    sideOfDestination !== null &&
    destination !== defenderBox &&
    !canJoinAlliance(G, defender, sideOfDestination);
  const shift = shiftAlliance(G, defender, direction, 1, {ignoreCap: true});
  return {
    power: defender,
    from: shift.from,
    to: shift.to,
    steps: shift.steps,
    forced,
    needsChoice: false,
  };
};

// ---------------------------------------------------------------------------
// Rule 14.2 — the player ally that aids a non-player power
// ---------------------------------------------------------------------------

/** The result of the 14.2 shift for a player ally aiding a non-player power. */
export interface AllyAidShiftResult {
  /** The defending ally whose chit moved. */
  power: Power;
  from: AllianceBox;
  to: AllianceBox;
  steps: number;
  direction: AllianceSide;
  /**
   * True when the two chits did not determine a direction (both neutral) and
   * the deterministic Triple-Entente-first default was used.  The printed
   * "defending power chooses" choice is not modelled for this voluntary aid.
   */
  defaultDirection: boolean;
  /** True when rule 8.4 stopped the chit entering a full alliance. */
  blocked: boolean;
}

/**
 * Rule 14.2: "The defender shifts their alliance chit away from the attacker
 * on the alliance track [8.2].  This includes a player ally that just agreed
 * to aid a minor power."
 *
 * The direction comes from the two chits exactly like an 8.2 declaration
 * shift.  Unlike a forced defender shift this is a voluntary aid, so rule
 * 8.4's three-player maximum is enforced (the 8.2 exception is not used).
 * The both-neutral case falls back deterministically to the Triple Entente,
 * then the Triple Alliance, because the aiding ally has already answered a
 * decision and there is no live prompt here.
 */
export const allyAidShift = (
  G: ImperialElegyState,
  attacker: Power,
  ally: Power,
  options: {side?: AllianceSide; steps?: number} = {},
): AllyAidShiftResult => {
  const derived = declarationShiftDirection(G.powers[attacker].alliance, G.powers[ally].alliance);
  const direction: AllianceSide =
    derived ?? options.side ?? (canJoinAlliance(G, ally, "te") ? "te" : "ta");
  const shift = shiftAlliance(G, ally, direction, options.steps ?? 1);
  return {
    power: ally,
    from: shift.from,
    to: shift.to,
    steps: shift.steps,
    direction,
    defaultDirection: derived === null,
    blocked: shift.blocked,
  };
};

// ---------------------------------------------------------------------------
// Rule 8.2 — the unified-Italy random declaration shift
// ---------------------------------------------------------------------------

/** The result of a unified-Italy declaration shift. */
export interface ItalyDeclarationShiftResult {
  /** True when the printed clause applied and the Italy chit moved. */
  applied: boolean;
  /** True when 8.2's random clause (a neutral attacker, no aid) decided it. */
  random: boolean;
  /** The server die, only when the random clause applied. */
  roll: number | null;
  side: AllianceSide | null;
  from: AllianceBox;
  to: AllianceBox;
  /** Boxes the chit actually moved (1 unless it was already at the extreme). */
  steps: number;
}

/**
 * Rule 8.2: "If a unified Italy is attacked by a neutral player and it is not
 * aided by a player [13.4.2], randomly determine where Italy shifts by rolling
 * a die (1-3 Triple Entente, 4-6 Triple Alliance)."  An aligned attacker
 * instead shifts Italy away from its own chit, exactly like any other 8.2
 * declaration.
 *
 * The roll is supplied by the caller (`ctx.random.Die(6)`) so the helper is a
 * pure state mutation and tests stay deterministic.  Italy is not a player
 * power, so rule 8.4's three-player cap does not apply to its chit.
 */
export const italyDeclarationShift = (
  G: ImperialElegyState,
  attacker: Power,
  rolled: number,
  aided: boolean,
): ItalyDeclarationShiftResult => {
  const from = italyAllianceBox(G);
  const unified = G.persistent.italyUnified === true || G.flags.italyUnified === true;
  if (!unified || aided) {
    return {applied: false, random: false, roll: null, side: null, from, to: from, steps: 0};
  }
  const stepsFor = (to: AllianceBox): number => (to === from ? 0 : 1);
  const attackerBox = G.powers[attacker]?.alliance ?? "neutral";
  if (attackerBox !== "neutral") {
    const direction = declarationShiftDirection(attackerBox, from);
    if (direction === null) {
      return {applied: false, random: false, roll: null, side: null, from, to: from, steps: 0};
    }
    const to = shiftItalyToward(G, direction);
    return {applied: true, random: false, roll: null, side: direction, from, to, steps: stepsFor(to)};
  }
  const side: AllianceSide = rolled <= 3 ? "te" : "ta";
  const to = shiftItalyToward(G, side);
  return {applied: true, random: true, roll: rolled, side, from, to, steps: stepsFor(to)};
};
